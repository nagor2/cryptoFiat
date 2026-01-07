#!/usr/bin/env python3
"""
Phase 2: Template-Driven Evolution

Handles intelligent template selection and multi-template fusion for evolution.
This phase enhances evolution by leveraging SLC's template intelligence.

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

@dataclass
class TemplateMatch:
    """Template match result"""
    template_path: str
    template_name: str
    category: str
    score: float
    compatibility: Dict[str, float]
    constraints: Dict[str, Any]
    domain_knowledge: Dict[str, Any]

@dataclass
class FusionStrategy:
    """Multi-template fusion strategy"""
    primary_template: TemplateMatch
    secondary_templates: List[TemplateMatch]
    fusion_rules: Dict[str, Any]
    conflict_resolution: Dict[str, str]

class TemplateEvolverPhase:
    """
    Phase 2: Template-driven evolution with intelligent template selection
    """
    
    def __init__(self, slc_base_path: str, config):
        self.slc_base_path = Path(slc_base_path)
        self.config = config
        self.logger = logging.getLogger("slc_openevolve_phase2")
        
    async def run(self, template: str, project_name: str, **kwargs) -> Dict[str, Any]:
        """Run complete Phase 2 workflow"""
        self.logger.info(f"🚀 Phase 2: Template-driven evolution for {project_name}")
        
        try:
            # Step 1: Select optimal templates
            template_matches = await self._select_optimal_templates(template, project_name, **kwargs)
            if not template_matches:
                return {
                    "success": False,
                    "phase": "template_selection",
                    "error": "No suitable templates found"
                }
            
            # Step 2: Create fusion strategy
            fusion_strategy = await self._create_fusion_strategy(template_matches)
            
            # Step 3: Generate template-guided configuration
            evolution_config = await self._generate_template_guided_config(fusion_strategy, project_name)
            
            # Step 4: Run evolution with template guidance
            evolution_result = await self._run_template_guided_evolution(evolution_config)
            
            # Step 5: Process results and update intelligence
            await self._update_template_intelligence(fusion_strategy, evolution_result)
            
            return {
                "success": True,
                "phase": "phase_2_complete",
                "template_matches": [tm.template_name for tm in template_matches],
                "fusion_strategy": fusion_strategy.fusion_rules,
                "evolution_result": evolution_result,
                "best_program_path": evolution_result.get("best_program_path")
            }
            
        except Exception as e:
            self.logger.error(f"Phase 2 failed: {e}")
            return {
                "success": False,
                "phase": "phase_2",
                "error": str(e)
            }
    
    async def _select_optimal_templates(self, template: str, project_name: str, **kwargs) -> List[TemplateMatch]:
        """Select optimal templates based on project requirements"""
        self.logger.info(f"🔍 Selecting optimal templates for {project_name}")
        
        # Analyze project requirements
        requirements = await self._analyze_project_requirements(template, project_name, **kwargs)
        
        # Load all available templates
        all_templates = await self._load_all_templates()
        
        # Evaluate each template
        template_matches = []
        for template_data in all_templates:
            match = await self._evaluate_template_match(template_data, requirements)
            if match.score > 0.5:  # Minimum threshold
                template_matches.append(match)
        
        # Sort by score and return top matches
        template_matches.sort(key=lambda x: x.score, reverse=True)
        return template_matches[:3]  # Top 3 matches
    
    async def _analyze_project_requirements(self, template: str, project_name: str, **kwargs) -> Dict[str, Any]:
        """Analyze project requirements for template matching"""
        domain = self._extract_domain_from_name(project_name)
        
        return {
            "domain": domain,
            "complexity": kwargs.get("complexity", "medium"),
            "template_type": template,
            "project_name": project_name,
            "requirements": kwargs.get("requirements", {}),
            "constraints": kwargs.get("constraints", {})
        }
    
    def _extract_domain_from_name(self, project_name: str) -> str:
        """Extract domain from project name"""
        name_lower = project_name.lower()
        
        domain_keywords = {
            "web": ["web", "api", "server", "http", "rest"],
            "ai_ml": ["ai", "ml", "neural", "model", "training"],
            "data": ["data", "pipeline", "etl", "analytics"],
            "mobile": ["mobile", "app", "ios", "android"],
            "desktop": ["desktop", "gui", "application"],
            "cli": ["cli", "command", "tool", "utility"]
        }
        
        for domain, keywords in domain_keywords.items():
            if any(keyword in name_lower for keyword in keywords):
                return domain
        
        return "general"
    
    async def _load_all_templates(self) -> List[Dict[str, Any]]:
        """Load all available SLC templates"""
        templates = []
        templates_dir = self.slc_base_path / ".context" / "modules"
        
        # Load core templates
        core_templates = [
            "core_foundation.json",
            "build_deployment.json",
            "networking_communication.json"
        ]
        
        for template_file in core_templates:
            template_path = templates_dir / template_file
            if template_path.exists():
                try:
                    with open(template_path, 'r', encoding='utf-8') as f:
                        template_data = json.load(f)
                        template_data['template_path'] = str(template_path)
                        templates.append(template_data)
                except Exception as e:
                    self.logger.warning(f"Failed to load template {template_file}: {e}")
        
        return templates
    
    async def _evaluate_template_match(self, template_data: Dict[str, Any], requirements: Dict[str, Any]) -> TemplateMatch:
        """Evaluate how well a template matches project requirements"""
        score = 0.0
        compatibility = {}
        
        # Domain compatibility
        template_domain = template_data.get("domain", "general")
        if template_domain == requirements["domain"]:
            score += 0.4
            compatibility["domain"] = 1.0
        elif template_domain == "general":
            score += 0.2
            compatibility["domain"] = 0.5
        else:
            compatibility["domain"] = 0.0
        
        # Complexity compatibility
        template_complexity = template_data.get("complexity", "medium")
        if template_complexity == requirements["complexity"]:
            score += 0.3
            compatibility["complexity"] = 1.0
        else:
            compatibility["complexity"] = 0.5
        
        # Feature compatibility
        template_features = template_data.get("features", [])
        required_features = requirements.get("requirements", {}).get("features", [])
        if required_features:
            feature_match = len(set(template_features) & set(required_features)) / len(required_features)
            score += feature_match * 0.3
            compatibility["features"] = feature_match
        else:
            compatibility["features"] = 0.5
        
        return TemplateMatch(
            template_path=template_data.get("template_path", ""),
            template_name=template_data.get("name", "Unknown"),
            category=template_data.get("category", "general"),
            score=min(score, 1.0),
            compatibility=compatibility,
            constraints=template_data.get("constraints", {}),
            domain_knowledge=template_data.get("domain_knowledge", {})
        )
    
    async def _create_fusion_strategy(self, template_matches: List[TemplateMatch]) -> FusionStrategy:
        """Create fusion strategy from template matches"""
        if not template_matches:
            raise ValueError("No template matches provided")
        
        primary = template_matches[0]
        secondary = template_matches[1:] if len(template_matches) > 1 else []
        
        fusion_rules = await self._generate_fusion_rules(primary, secondary)
        conflict_resolution = await self._create_conflict_resolution(primary, secondary)
        
        return FusionStrategy(
            primary_template=primary,
            secondary_templates=secondary,
            fusion_rules=fusion_rules,
            conflict_resolution=conflict_resolution
        )
    
    async def _generate_fusion_rules(self, primary: TemplateMatch, secondary: List[TemplateMatch]) -> Dict[str, Any]:
        """Generate fusion rules for template combination"""
        return {
            "fusion_methods": ["primary_dominant", "consensus", "feature_specific"],
            "primary_weight": 0.7,
            "secondary_weight": 0.3,
            "conflict_resolution": "primary_wins",
            "feature_merging": "union",
            "constraint_handling": "strictest"
        }
    
    async def _create_conflict_resolution(self, primary: TemplateMatch, secondary: List[TemplateMatch]) -> Dict[str, str]:
        """Create conflict resolution rules"""
        return {
            "architecture": "primary",
            "dependencies": "merge",
            "configuration": "primary",
            "code_style": "consensus"
        }
    
    async def _generate_template_guided_config(self, fusion_strategy: FusionStrategy, project_name: str) -> Dict[str, Any]:
        """Generate evolution configuration guided by templates"""
        primary = fusion_strategy.primary_template
        
        # Create enhanced prompt template
        prompt_template = await self._create_enhanced_prompt_template(fusion_strategy)
        
        # Generate initial code based on templates
        initial_code = self._generate_template_initial_code(primary, fusion_strategy.secondary_templates)
        
        return {
            "project_name": project_name,
            "prompt_template": prompt_template,
            "initial_code": initial_code,
            "constraints": primary.constraints,
            "domain_knowledge": primary.domain_knowledge,
            "fusion_rules": fusion_strategy.fusion_rules,
            "evaluation_criteria": {
                "template_compliance": 0.3,
                "performance": 0.3,
                "code_quality": 0.2,
                "feature_completeness": 0.2
            }
        }
    
    async def _create_enhanced_prompt_template(self, fusion_strategy: FusionStrategy) -> str:
        """Create enhanced prompt template using fusion strategy"""
        primary = fusion_strategy.primary_template
        secondary = fusion_strategy.secondary_templates
        
        prompt_parts = [
            f"Create a {primary.category} application following these guidelines:",
            "",
            f"**Primary Template**: {primary.template_name}",
            f"- Domain: {primary.category}",
            f"- Constraints: {list(primary.constraints.keys())}",
            f"- Domain Knowledge: {list(primary.domain_knowledge.keys())}",
            ""
        ]
        
        if secondary:
            prompt_parts.extend([
                "**Secondary Templates**:",
                *[f"- {t.template_name} ({t.category})" for t in secondary],
                ""
            ])
        
        prompt_parts.extend([
            "**Fusion Rules**:",
            f"- Primary Weight: {fusion_strategy.fusion_rules['primary_weight']}",
            f"- Secondary Weight: {fusion_strategy.fusion_rules['secondary_weight']}",
            f"- Conflict Resolution: {fusion_strategy.fusion_rules['conflict_resolution']}",
            "",
            "**Requirements**:",
            "- Follow primary template architecture",
            "- Incorporate best practices from secondary templates",
            "- Maintain code quality and performance",
            "- Ensure feature completeness"
        ])
        
        return "\n".join(prompt_parts)
    
    def _generate_template_initial_code(self, primary: TemplateMatch, secondary: List[TemplateMatch]) -> str:
        """Generate initial code based on template fusion"""
        # This would generate initial code structure based on templates
        # For now, return a placeholder
        return f"""# Generated from {primary.template_name} template
# Domain: {primary.category}
# Constraints: {list(primary.constraints.keys())}

def main():
    # Template-guided implementation
    pass

if __name__ == "__main__":
    main()
"""
    
    async def _run_template_guided_evolution(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Run evolution with template guidance"""
        # This would integrate with OpenEvolve
        # For now, return a mock result
        return {
            "success": True,
            "best_program_path": f"evolved_{config['project_name']}.py",
            "metrics": {
                "template_compliance": 0.85,
                "performance": 0.78,
                "code_quality": 0.82,
                "feature_completeness": 0.90
            },
            "iterations": 1000
        }
    
    async def _generate_template_evolution_report(self, fusion_strategy: FusionStrategy, evolution_result: Dict[str, Any]) -> str:
        """Generate template evolution report"""
        report_path = Path("template_evolution_report.md")
        
        primary = fusion_strategy.primary_template
        secondary = fusion_strategy.secondary_templates
        
        # Build report content using string concatenation to avoid f-string issues
        report_lines = [
            "# Template Evolution Report",
            "",
            "## Template Fusion Strategy",
            f"- **Primary Template**: {primary.template_name} ({primary.category})",
            f"- **Secondary Templates**: {', '.join([f'{t.template_name} ({t.category})' for t in secondary])}",
            f"- **Fusion Method**: {fusion_strategy.fusion_rules['fusion_methods']}",
            "",
            "## Evolution Results",
            f"- **Success**: {evolution_result.get('success', False)}",
            f"- **Best Program Path**: {evolution_result.get('best_program_path', 'N/A')}",
            f"- **Metrics**: {json.dumps(evolution_result.get('metrics', {}), indent=2)}",
            "",
            "## Template Compliance",
            f"- **Primary Template Score**: {primary.score:.2f}",
            f"- **Domain Knowledge Applied**: {list(primary.domain_knowledge.keys())}",
            f"- **Constraints Satisfied**: {list(primary.constraints.keys())}",
            "",
            "## Fusion Analysis",
            "- **Architecture**: Primary template dominant",
            "- **Code Style**: Consensus approach",
            "- **Dependencies**: Merged unique requirements",
            "- **Configuration**: Primary with enhancements",
            "",
            "## Recommendations",
            "1. Review template compliance metrics",
            "2. Validate against template constraints",
            "3. Consider further evolution if needed",
            "4. Update template intelligence with learnings"
        ]
        
        report_content = "\n".join(report_lines)
        report_path.write_text(report_content, encoding='utf-8')
        return str(report_path)
    
    async def _update_template_intelligence(self, fusion_strategy: FusionStrategy, evolution_result: Dict[str, Any]):
        """Update template intelligence with evolution learnings"""
        # Update template intelligence file
        intelligence_path = self.slc_base_path / ".context" / "template_intelligence.json"
        
        if intelligence_path.exists():
            with open(intelligence_path, 'r', encoding='utf-8') as f:
                intelligence = json.load(f)
        else:
            intelligence = {
                "system": "Advanced Template Intelligence",
                "version": "1.0.0",
                "sessions": [],
                "statistics": {
                    "templates_generated": 0,
                    "successful_recommendations": 0,
                    "user_satisfaction": 0.0
                }
            }
        
        # Add evolution session
        session = {
            "timestamp": asyncio.get_event_loop().time(),
            "primary_template": fusion_strategy.primary_template.template_name,
            "secondary_templates": [t.template_name for t in fusion_strategy.secondary_templates],
            "evolution_success": evolution_result.get("success", False),
            "metrics": evolution_result.get("metrics", {}),
            "fusion_strategy": fusion_strategy.fusion_rules
        }
        
        intelligence["sessions"].append(session)
        intelligence["statistics"]["templates_generated"] += 1
        
        # Save updated intelligence
        with open(intelligence_path, 'w', encoding='utf-8') as f:
            json.dump(intelligence, f, indent=2, ensure_ascii=False)

class SLCTemplateLoader:
    """Helper class for loading SLC templates"""
    
    def __init__(self, slc_base_path: str):
        self.slc_base_path = Path(slc_base_path)
    
    async def load_template(self, template_path: str) -> Dict[str, Any]:
        """Load a specific template"""
        template_file = self.slc_base_path / ".context" / "modules" / template_path
        
        if not template_file.exists():
            raise FileNotFoundError(f"Template not found: {template_file}")
        
        with open(template_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    async def get_template_requirements(self, template_path: str) -> Dict[str, Any]:
        """Get requirements for a specific template"""
        template = await self.load_template(template_path)
        return template.get("requirements", {})
