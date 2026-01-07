#!/usr/bin/env python3
"""
Phase 1: Setup + Optimization

Handles project setup with SLC templates and hands off to OpenEvolve for optimization.
This is the foundational phase that establishes the basic integration workflow.

Version: 1.0.0
Created: 2025-01-16
"""

import os
import sys
import json
import asyncio
import subprocess
import logging
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass

# Add SLC context to path
context_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(context_root))

@dataclass
class SetupResult:
    """Result of project setup phase"""
    success: bool
    project_path: str
    template_used: str
    initial_code_path: str
    evaluation_file_path: str
    config_file_path: str
    errors: List[str] = None
    warnings: List[str] = None

@dataclass
class OptimizationResult:
    """Result of optimization phase"""
    success: bool
    best_program_path: str
    metrics: Dict[str, Any]
    iterations_completed: int
    checkpoint_path: str
    evolution_log: str
    errors: List[str] = None

class SetupOptimizationPhase:
    """
    Phase 1: Setup project with SLC and optimize with OpenEvolve
    """
    
    def __init__(self, slc_base_path: str, config):
        self.slc_base_path = Path(slc_base_path)
        self.config = config
        self.logger = logging.getLogger("slc_openevolve_phase1")
        
    async def run(self, template: str, project_name: str, **kwargs) -> Dict[str, Any]:
        """Run complete Phase 1 workflow"""
        self.logger.info(f"🚀 Phase 1: Setting up {project_name} with template {template}")
        
        # Step 1: Setup project with SLC
        setup_result = await self._setup_project(template, project_name)
        if not setup_result.success:
            return {
                "success": False,
                "phase": "setup",
                "errors": setup_result.errors,
                "warnings": setup_result.warnings
            }
        
        # Step 2: Prepare OpenEvolve configuration
        evolution_config = await self._prepare_evolution_config(setup_result, **kwargs)
        
        # Step 3: Run OpenEvolve optimization
        optimization_result = await self._run_optimization(evolution_config)
        
        # Step 4: Process and integrate results
        integration_result = await self._integrate_results(setup_result, optimization_result)
        
        return {
            "success": True,
            "phase": "phase_1_complete",
            "setup_result": setup_result,
            "optimization_result": optimization_result,
            "integration_result": integration_result,
            "project_path": setup_result.project_path,
            "best_program_path": optimization_result.best_program_path if optimization_result.success else None
        }
    
    async def _setup_project(self, template: str, project_name: str) -> SetupResult:
        """Setup project using SLC templates"""
        self.logger.info(f"📁 Setting up project: {project_name}")
        
        try:
            # Use SLC CLI to create project
            result = await self._run_slc_command([
                "create", template, project_name
            ])
            
            if result["success"]:
                project_path = Path(project_name)
                
                # Generate evolution-ready files
                evolution_files = await self._generate_evolution_files(project_path, template)
                
                return SetupResult(
                    success=True,
                    project_path=str(project_path),
                    template_used=template,
                    initial_code_path=evolution_files["initial_code"],
                    evaluation_file_path=evolution_files["evaluation"],
                    config_file_path=evolution_files["config"]
                )
            else:
                return SetupResult(
                    success=False,
                    project_path="",
                    template_used=template,
                    initial_code_path="",
                    evaluation_file_path="",
                    config_file_path="",
                    errors=result.get("errors", [])
                )
                
        except Exception as e:
            self.logger.error(f"Setup failed: {e}")
            return SetupResult(
                success=False,
                project_path="",
                template_used=template,
                initial_code_path="",
                evaluation_file_path="",
                config_file_path="",
                errors=[str(e)]
            )
    
    async def _generate_evolution_files(self, project_path: Path, template: str) -> Dict[str, str]:
        """Generate OpenEvolve-ready files from SLC template"""
        self.logger.info("🔧 Generating evolution files")
        
        # Create evolution directory
        evolution_dir = project_path / "evolution"
        evolution_dir.mkdir(exist_ok=True)
        
        # Generate initial program with evolution blocks
        initial_code_path = evolution_dir / "initial_program.py"
        initial_code = self._generate_initial_code(template)
        initial_code_path.write_text(initial_code, encoding='utf-8')
        
        # Generate evaluation function
        evaluation_path = evolution_dir / "evaluator.py"
        evaluation_code = self._generate_evaluation_function(template)
        evaluation_path.write_text(evaluation_code, encoding='utf-8')
        
        # Generate OpenEvolve configuration
        config_path = evolution_dir / "config.yaml"
        config_content = self._generate_evolution_config(template)
        config_path.write_text(config_content, encoding='utf-8')
        
        return {
            "initial_code": str(initial_code_path),
            "evaluation": str(evaluation_path),
            "config": str(config_path)
        }
    
    def _generate_initial_code(self, template: str) -> str:
        """Generate initial code with evolution blocks"""
        return f'''#!/usr/bin/env python3
"""
Initial program generated from SLC template: {template}
Ready for OpenEvolve optimization.
"""

# EVOLVE-BLOCK-START
def main_algorithm():
    """
    Main algorithm to be optimized by OpenEvolve.
    This function will be evolved to improve performance.
    """
    # TODO: Implement algorithm based on template {template}
    # This is a placeholder that will be evolved
    return "placeholder_result"

# EVOLVE-BLOCK-END

def evaluate_result(result):
    """Evaluation function for the algorithm result"""
    # TODO: Implement evaluation logic
    return 0.0

if __name__ == "__main__":
    result = main_algorithm()
    score = evaluate_result(result)
    print(f"Result: {{result}}, Score: {{score}}")
'''
    
    def _generate_evaluation_function(self, template: str) -> str:
        """Generate evaluation function for OpenEvolve"""
        return f'''#!/usr/bin/env python3
"""
Evaluation function for OpenEvolve evolution.
Template: {template}
"""

import sys
import os
from pathlib import Path

def evaluate_program(program_path: str) -> dict:
    """
    Evaluate the evolved program and return metrics.
    
    Args:
        program_path: Path to the evolved program
        
    Returns:
        Dictionary with evaluation metrics
    """
    try:
        # Import the evolved program
        sys.path.insert(0, os.path.dirname(program_path))
        
        # Execute the program and capture results
        # This is a basic evaluation - customize based on your needs
        result = {{"score": 0.0, "valid": True, "error": None}}
        
        return result
        
    except Exception as e:
        return {{
            "score": 0.0,
            "valid": False,
            "error": str(e)
        }}

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python evaluator.py <program_path>")
        sys.exit(1)
        
    program_path = sys.argv[1]
    result = evaluate_program(program_path)
    print(json.dumps(result))
'''
    
    def _generate_evolution_config(self, template: str) -> str:
        """Generate OpenEvolve configuration"""
        return f'''# OpenEvolve Configuration
# Generated for SLC template: {template}

max_iterations: {self.config.iterations}
checkpoint_interval: 10

llm:
  primary_model: "gpt-4"
  temperature: 0.7
  max_tokens: 2048

database:
  population_size: 100
  num_islands: 3

evaluator:
  enable_artifacts: true
  timeout_seconds: 30

prompt:
  include_artifacts: true
  max_artifact_bytes: 4096

# SLC Integration
slc_integration:
  template: "{template}"
  phase: "phase_1"
  auto_handoff: true
'''
    
    async def _prepare_evolution_config(self, setup_result: SetupResult, **kwargs) -> Dict[str, Any]:
        """Prepare configuration for OpenEvolve"""
        self.logger.info("⚙️ Preparing evolution configuration")
        
        config = {
            "initial_program_path": setup_result.initial_code_path,
            "evaluation_file": setup_result.evaluation_file_path,
            "config_path": setup_result.config_file_path,
            "output_dir": f"{setup_result.project_path}/evolution/output",
            "iterations": kwargs.get("iterations", self.config.iterations),
            "target_score": kwargs.get("target_score", self.config.target_score)
        }
        
        return config
    
    async def _run_optimization(self, config: Dict[str, Any]) -> OptimizationResult:
        """Run OpenEvolve optimization"""
        self.logger.info("🔄 Running OpenEvolve optimization")
        
        try:
            # Import OpenEvolve
            openevolve_path = Path(self.config.openevolve_path)
            if not openevolve_path.exists():
                return OptimizationResult(
                    success=False,
                    best_program_path="",
                    metrics={},
                    iterations_completed=0,
                    checkpoint_path="",
                    evolution_log="",
                    errors=[f"OpenEvolve not found at: {openevolve_path}"]
                )
            
            # Add OpenEvolve to path
            sys.path.insert(0, str(openevolve_path))
            
            # Import and run OpenEvolve
            from openevolve import OpenEvolve
            
            evolve = OpenEvolve(
                initial_program_path=config["initial_program_path"],
                evaluation_file=config["evaluation_file"],
                config_path=config["config_path"],
                output_dir=config["output_dir"]
            )
            
            best_program = await evolve.run(
                iterations=config["iterations"],
                target_score=config["target_score"]
            )
            
            return OptimizationResult(
                success=True,
                best_program_path=str(best_program.path),
                metrics=best_program.metrics,
                iterations_completed=config["iterations"],
                checkpoint_path=config["output_dir"],
                evolution_log="Evolution completed successfully"
            )
            
        except Exception as e:
            self.logger.error(f"Optimization failed: {e}")
            return OptimizationResult(
                success=False,
                best_program_path="",
                metrics={},
                iterations_completed=0,
                checkpoint_path="",
                evolution_log="",
                errors=[str(e)]
            )
    
    async def _integrate_results(self, setup_result: SetupResult, optimization_result: OptimizationResult) -> Dict[str, Any]:
        """Integrate optimization results back into SLC project"""
        self.logger.info("🔗 Integrating results into SLC project")
        
        try:
            # Update project with optimized code
            if optimization_result.success:
                await self._update_project_with_results(setup_result, optimization_result)
            
            # Update SLC context with evolution metadata
            await self._update_slc_context(setup_result, optimization_result)
            
            # Generate evolution report
            report = await self._generate_evolution_report(setup_result, optimization_result)
            
            return {
                "success": True,
                "project_updated": optimization_result.success,
                "context_updated": True,
                "report_generated": True,
                "report_path": report
            }
            
        except Exception as e:
            self.logger.error(f"Integration failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def _update_project_with_results(self, setup_result: SetupResult, optimization_result: OptimizationResult):
        """Update project with optimized code"""
        if optimization_result.success:
            # Copy best program to project
            best_program_path = Path(optimization_result.best_program_path)
            project_path = Path(setup_result.project_path)
            
            # Create optimized version
            optimized_path = project_path / "src" / "optimized_version.py"
            optimized_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Copy and adapt the optimized code
            optimized_code = best_program_path.read_text(encoding='utf-8')
            optimized_path.write_text(optimized_code, encoding='utf-8')
    
    async def _update_slc_context(self, setup_result: SetupResult, optimization_result: OptimizationResult):
        """Update SLC context with evolution metadata"""
        # Create evolution metadata
        evolution_metadata = {
            "template_used": setup_result.template_used,
            "project_name": Path(setup_result.project_path).name,
            "evolution_success": optimization_result.success,
            "iterations_completed": optimization_result.iterations_completed,
            "best_metrics": optimization_result.metrics,
            "checkpoint_path": optimization_result.checkpoint_path
        }
        
        # Save to SLC context
        context_path = Path(setup_result.project_path) / ".context" / "evolution_metadata.json"
        context_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(context_path, 'w', encoding='utf-8') as f:
            json.dump(evolution_metadata, f, indent=2, ensure_ascii=False)
    
    async def _generate_evolution_report(self, setup_result: SetupResult, optimization_result: OptimizationResult) -> str:
        """Generate evolution report"""
        report_path = Path(setup_result.project_path) / "evolution_report.md"
        
        report_content = f"""# Evolution Report

## Project Information
- **Template**: {setup_result.template_used}
- **Project**: {Path(setup_result.project_path).name}
- **Evolution Success**: {optimization_result.success}

## Evolution Results
- **Iterations Completed**: {optimization_result.iterations_completed}
- **Best Program Path**: {optimization_result.best_program_path}
- **Checkpoint Path**: {optimization_result.checkpoint_path}

## Metrics
```json
{json.dumps(optimization_result.metrics, indent=2)}
```

## Errors
{chr(10).join(optimization_result.errors) if optimization_result.errors else "None"}

## Next Steps
1. Review the optimized code
2. Test the evolved solution
3. Consider further evolution if needed
"""
        
        report_path.write_text(report_content, encoding='utf-8')
        return str(report_path)
    
    async def _run_slc_command(self, args: List[str]) -> Dict[str, Any]:
        """Run SLC CLI command"""
        try:
            slc_script = self.slc_base_path / "slc"
            cmd = [str(slc_script)] + args
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                cwd=self.slc_base_path
            )
            
            return {
                "success": result.returncode == 0,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "errors": [result.stderr] if result.stderr else []
            }
            
        except Exception as e:
            return {
                "success": False,
                "stdout": "",
                "stderr": str(e),
                "errors": [str(e)]
            } 