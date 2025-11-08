"""
Interfaces para adapters en Python
"""

import sys
import os
# Agregar el directorio padre al path para imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from adapters.file_adapter import IFileAdapter

__all__ = ["IFileAdapter"]

