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
from adapters.file_adapter import IFileAdapter


class JsonAdapter(IFileAdapter[Any]):
    """
    Implementación del adaptador JSON que convierte datos a/desde bytes.
    """

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
            print(f"[JsonAdapter] Error al serializar a Buffer: {e}", file=sys.stderr)
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
            error_msg = "[JsonAdapter] Error: No se puede parsear un buffer vacío."
            print(error_msg, file=sys.stderr)
            raise ValueError(error_msg)

        try:
            json_string = buffer.decode("utf-8")
            return json.loads(json_string)
        except json.JSONDecodeError as e:
            error_msg = f"[JsonAdapter] Error al parsear JSON: {e}"
            print(error_msg, file=sys.stderr)
            raise ValueError(error_msg)
        except Exception as e:
            error_msg = f"[JsonAdapter] Error al parsear desde Buffer: {e}"
            print(error_msg, file=sys.stderr)
            raise ValueError(error_msg)


class JsonAdapterUtility(BaseUtility):
    """
    Utility que proporciona una instancia de JsonAdapter.
    Compatible con el sistema de módulos de ADC Platform.
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(config)
        self._instance = None

    def get_instance(self) -> IFileAdapter[Any]:
        """
        Retorna la instancia singleton del JsonAdapter.

        Returns:
            IFileAdapter: Una instancia del adaptador JSON
        """
        if self._instance is None:
            self._instance = JsonAdapter()
        return self._instance


def main():
    """
    Punto de entrada principal para el módulo Python.
    Inicia el servidor IPC y espera llamadas desde Node.js.
    """
    print("[JsonAdapterUtility] Iniciando utility Python...", file=sys.stderr)

    # Crear la instancia del utility
    utility = JsonAdapterUtility()

    # Iniciar el servidor IPC (bloqueante)
    utility.start_ipc_server()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n[JsonAdapterUtility] Detenido por usuario", file=sys.stderr)
        sys.exit(0)
    except Exception as e:
        print(f"[JsonAdapterUtility] Error fatal: {e}", file=sys.stderr)
        sys.exit(1)

