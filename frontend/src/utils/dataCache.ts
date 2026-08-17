// Cache en memoria mínima (sin librería nueva) para evitar el flash de
// "Cargando..." al volver a una pantalla ya visitada (Inicio → Turnos →
// Pacientes → Inicio). Solo sirve como placeholder inicial: el componente
// siempre vuelve a pedir datos frescos al montar y sobrescribe la cache con
// la respuesta real — nunca se confía en el valor cacheado como definitivo,
// así que no hay riesgo de mostrar un estado desactualizado por más de lo
// que tarda ese fetch.
const cache = new Map<string, unknown>()

export function getCachedData<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined
}

export function setCachedData<T>(key: string, data: T): void {
  cache.set(key, data)
}

// Se llama al cerrar sesión: sin esto, si otro usuario (de otro consultorio)
// inicia sesión en la misma pestaña, vería por un instante datos cacheados
// del consultorio anterior antes de que el fetch fresco los reemplace.
export function clearDataCache(): void {
  cache.clear()
}
