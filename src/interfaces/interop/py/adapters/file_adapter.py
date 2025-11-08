"""
Interfaz para adaptadores de archivos.
Permite convertir datos entre diferentes formatos y buffers.
"""

from abc import ABC, abstractmethod
from typing import Any, TypeVar, Generic

T = TypeVar("T")


class IFileAdapter(ABC, Generic[T]):
    """
    Interfaz para adaptadores de archivos que convierten datos
    entre objetos Python y bytes (buffers).
    """

    @abstractmethod
    def to_buffer(self, data: T) -> bytes:
        """
        Convierte datos a bytes (buffer).

        Args:
            data: Los datos a convertir

        Returns:
            bytes: Los datos serializados como bytes
        """
        pass

    @abstractmethod
    def from_buffer(self, buffer: bytes) -> T:
        """
        Convierte bytes (buffer) a datos.

        Args:
            buffer: Los bytes a deserializar

        Returns:
            T: Los datos deserializados
        """
        pass

