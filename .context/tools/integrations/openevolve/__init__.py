"""
OpenEvolve Integration Package for Smart Layered Context

This package provides complete integration between SLC and OpenEvolve
for evolutionary code optimization and project management.

Version: 1.0.0
Created: 2025-01-16
"""

from .integration_manager import OpenEvolveIntegrationManager
from .setup_optimization import SetupOptimizationPhase
from .template_evolver import TemplateEvolverPhase
from .context_aware_evolver import ContextAwareEvolverPhase

__version__ = "1.0.0"
__author__ = "SLC Integration Team"

__all__ = [
    "OpenEvolveIntegrationManager",
    "SetupOptimizationPhase", 
    "TemplateEvolverPhase",
    "ContextAwareEvolverPhase"
] 