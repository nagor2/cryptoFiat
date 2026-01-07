#!/usr/bin/env python3
"""
OpenEvolve Integration Manager

Main coordinator for SLC-OpenEvolve integration across all three phases.
Handles phase selection, configuration, and execution flow.

Version: 1.0.0
Created: 2025-01-16
"""

import os
import sys
import json
import asyncio
import logging
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass

# Add SLC context to path
context_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(context_root))

try:
    from tools.cli_modules.base_command import BaseCommand
except ImportError:
    print("❌ SLC CLI modules not found. Ensure you're in the SLC project root.")
    sys.exit(1)

@dataclass
class IntegrationConfig:
    """Configuration for OpenEvolve integration"""
    openevolve_path: str = "openevolve/"
    integration_mode: str = "phase_1"
    auto_handoff: bool = True
    context_sync: bool = True
    template_awareness: bool = True
    reflection_integration: bool = True
    checkpoint_management: bool = True
    iterations: int = 1000
    target_score: Optional[float] = None

class OpenEvolveIntegrationManager:
    """
    Main integration manager for SLC-OpenEvolve coordination
    """
    
    def __init__(self, slc_base_path: str, config: Optional[IntegrationConfig] = None):
        self.slc_base_path = Path(slc_base_path)
        self.config = config or IntegrationConfig()
        self.logger = self._setup_logging()
        
        # Initialize phase managers
        self.phase_managers = {
            "phase_1": None,  # Will be lazy-loaded
            "phase_2": None,
            "phase_3": None
        }
        
        # Load integration configuration
        self.integration_config = self._load_integration_config()
        
    def _setup_logging(self) -> logging.Logger:
        """Setup logging for integration manager"""
        logger = logging.getLogger("slc_openevolve_integration")
        logger.setLevel(logging.INFO)
        
        if not logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            handler.setFormatter(formatter)
            logger.addHandler(handler)
            
        return logger
    
    def _load_integration_config(self) -> Dict[str, Any]:
        """Load integration configuration from module file"""
        config_path = self.slc_base_path / ".context" / "modules" / "integrations" / "openevolve_integration.json"
        
        if not config_path.exists():
            self.logger.warning(f"Integration config not found: {config_path}")
            return {}
            
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            self.logger.error(f"Failed to load integration config: {e}")
            return {}
    
    def get_phase_manager(self, phase: str):
        """Lazy-load phase manager"""
        if self.phase_managers[phase] is None:
            if phase == "phase_1":
                from .setup_optimization import SetupOptimizationPhase
                self.phase_managers[phase] = SetupOptimizationPhase(self.slc_base_path, self.config)
            elif phase == "phase_2":
                from .template_evolver import TemplateEvolverPhase
                self.phase_managers[phase] = TemplateEvolverPhase(self.slc_base_path, self.config)
            elif phase == "phase_3":
                from .context_aware_evolver import ContextAwareEvolverPhase
                self.phase_managers[phase] = ContextAwareEvolverPhase(self.slc_base_path, self.config)
                
        return self.phase_managers[phase]
    
    async def run_phase_1(self, template: str, project_name: str, **kwargs) -> Dict[str, Any]:
        """Run Phase 1: Setup + Optimization"""
        self.logger.info("🚀 Starting Phase 1: Setup + Optimization")
        
        phase_manager = self.get_phase_manager("phase_1")
        result = await phase_manager.run(template, project_name, **kwargs)
        
        self.logger.info("✅ Phase 1 completed successfully")
        return result
    
    async def run_phase_2(self, template: str, project_name: str, **kwargs) -> Dict[str, Any]:
        """Run Phase 2: Templates + Generation"""
        self.logger.info("🚀 Starting Phase 2: Templates + Generation")
        
        phase_manager = self.get_phase_manager("phase_2")
        result = await phase_manager.run(template, project_name, **kwargs)
        
        self.logger.info("✅ Phase 2 completed successfully")
        return result
    
    async def run_phase_3(self, task_description: str, **kwargs) -> Dict[str, Any]:
        """Run Phase 3: Context + Pipeline"""
        self.logger.info("🚀 Starting Phase 3: Context + Pipeline")
        
        phase_manager = self.get_phase_manager("phase_3")
        result = await phase_manager.run(task_description, **kwargs)
        
        self.logger.info("✅ Phase 3 completed successfully")
        return result
    
    async def run_evolution(self, template: str, project_name: str, phase: str = "phase_1", **kwargs) -> Dict[str, Any]:
        """Run evolution with specified phase"""
        self.logger.info(f"🔄 Running evolution with {phase}")
        
        if phase == "phase_1":
            return await self.run_phase_1(template, project_name, **kwargs)
        elif phase == "phase_2":
            return await self.run_phase_2(template, project_name, **kwargs)
        elif phase == "phase_3":
            return await self.run_phase_3(f"{template} {project_name}", **kwargs)
        else:
            raise ValueError(f"Unknown phase: {phase}")
    
    def get_status(self) -> Dict[str, Any]:
        """Get integration status"""
        return {
            "integration_mode": self.config.integration_mode,
            "openevolve_path": self.config.openevolve_path,
            "phases_available": list(self.phase_managers.keys()),
            "config_loaded": bool(self.integration_config),
            "slc_base_path": str(self.slc_base_path)
        }
    
    def validate_environment(self) -> Dict[str, Any]:
        """Validate integration environment"""
        issues = []
        warnings = []
        
        # Check OpenEvolve installation
        openevolve_path = Path(self.config.openevolve_path)
        if not openevolve_path.exists():
            issues.append(f"OpenEvolve not found at: {openevolve_path}")
        
        # Check SLC structure
        slc_context = self.slc_base_path / ".context"
        if not slc_context.exists():
            issues.append("SLC .context directory not found")
        
        # Check integration config
        if not self.integration_config:
            warnings.append("Integration configuration not loaded")
        
        return {
            "valid": len(issues) == 0,
            "issues": issues,
            "warnings": warnings
        } 