#!/usr/bin/env python3
"""
JsonFileAdapter - Utility para convertir datos JSON a/desde buffers.
Versión 1.0.0-py - Implementación en Python con interoperabilidad IPC.
"""

import json
import sys
from typing import Any, Dict, Optional

# Importar las interfaces base de ADC Platform
from base_module import BaseUtility
from kernel_logger import get_kernel_logger


class JsonAdapterUtility(BaseUtility):
    """
    Utility que proporciona métodos para convertir datos JSON a/desde bytes.
    Compatible con el sistema de módulos de ADC Platform.
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(config)

    def toBuffer(self, data: Any) -> bytes:
        """Alias camelCase para TypeScript"""
        return self.to_buffer(data)

    def to_buffer(self, data: Any) -> bytes:
        """
        Convierte datos a bytes (buffer) en formato JSON.

        Args:
            data: Los datos a convertir (cualquier objeto serializable a JSON)

        Returns:
            bytes: Los datos serializados como bytes UTF-8
        """
        try:
            json_string = json.dumps(data, indent=2, ensure_ascii=False)
            return json_string.encode("utf-8")
        except Exception as e:
            self.logger.error(f"Error al serializar a Buffer: {e}")
            return b""

    def fromBuffer(self, buffer: bytes) -> Any:
        """Alias camelCase para TypeScript"""
        return self.from_buffer(buffer)

    def from_buffer(self, buffer: bytes) -> Any:
        """
        Convierte bytes (buffer) a datos Python parseando JSON.

        Args:
            buffer: Los bytes en formato JSON UTF-8

        Returns:
            Any: Los datos deserializados

        Raises:
            ValueError: Si el buffer está vacío o no es JSON válido
        """
        if len(buffer) == 0:
            error_msg = "Error: No se puede parsear un buffer vacío."
            self.logger.error(error_msg)
            raise ValueError(error_msg)

        try:
            json_string = buffer.decode("utf-8")
            return json.loads(json_string)
        except json.JSONDecodeError as e:
            error_msg = f"Error al parsear JSON: {e}"
            self.logger.error(error_msg)
            raise ValueError(error_msg)
        except Exception as e:
            error_msg = f"Error al parsear desde Buffer: {e}"
            self.logger.error(error_msg)
            raise ValueError(error_msg)


def main():
    """
    Punto de entrada principal para el módulo Python.
    Inicia el servidor IPC y espera llamadas desde Node.js.
    """
    utility = JsonAdapterUtility()
    utility.logger.ok("Iniciando utility Python...")
    utility.start_ipc_server()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger = get_kernel_logger("json-file-adapter")
        logger.info("Detenido por usuario")
        sys.exit(0)
    except Exception as e:
        logger = get_kernel_logger("json-file-adapter")
        logger.error(f"Error fatal: {e}")
        sys.exit(1)
