# Implementación: Rediseño de la ventana "Pasar Datos" y "Nuevo Partido"

Se solicita ampliar la ventana de "Pasar Datos" y mejorar la creación de nuevos partidos (buscador de rivales y escudos personalizados).

## User Review Required

> [!WARNING]  
> **Modificaciones en Base de Datos Requeridas**  
> Para poder guardar toda esta nueva información, he actualizado el archivo `supabase/convocatorias.sql`. Puesto que tienes una base de datos real conectada en Supabase, **tendrás que copiar y pegar este código SQL actualizado en el panel de Supabase** (SQL Editor) antes de poder guardar los datos sin errores.

## Open Questions

> [!IMPORTANT]
> **Sobre la subida de escudos locales:**
> Cuando subas una foto desde tu disco duro para un escudo nuevo, lo ideal es guardarlo en el *Storage* de Supabase para que todos lo puedan ver. Si no tienes el Storage configurado en Supabase, la otra opción es obligar a usar una URL de internet. ¿Tienes el Storage de Supabase activado para guardar archivos, o prefieres que de momento solo se permita pegar un enlace de internet (URL) para los escudos nuevos?

## Proposed Changes

### Database Schema Updates
Actualizar el script `supabase/convocatorias.sql` para añadir las siguientes columnas:

#### [MODIFY] `matches` table
- Añadir `tactical_system` (TEXT)
- Añadir `custom_shield_url` (TEXT) - Para guardar el escudo personalizado del partido si es necesario.

#### [MODIFY] `player_match_stats` table
- Añadir `position` (TEXT)
- Añadir `is_starter` (BOOLEAN DEFAULT TRUE)
- Añadir `substituted_for` (UUID REFERENCES players(id)) para registrar por quién entró.
- Añadir `substituted_minute` (INTEGER)
- Añadir `rating` (INTEGER)
- Añadir `comments` (TEXT)

---

### Application Types and State

#### [MODIFY] `src/types/index.ts`
- Actualizar `Match` con `tactical_system` y `custom_shield_url`.
- Actualizar `PlayerMatchStats` con los nuevos campos de estadísticas.

---

### UI / Component Updates

#### [MODIFY] `src/pages/Matches.tsx`

**1. Buscador de Rivales (Nuevo Partido)**
- Cambiar el campo de texto "Rival" por un combobox/buscador.
- Este buscador sugerirá equipos de la base de datos local (`dbTeams`).
- Si el usuario escribe un nombre que no está en la lista, aparecerá la opción "Crear equipo nuevo: [Nombre]".
- Al seleccionar la opción de equipo nuevo, se mostrará un campo para insertar la URL de la imagen del escudo (o botón de subida local, pendiente de confirmación).

**2. Modal "Pasar Datos" Ampliado**
- Selector de "Sistema de Juego" con una lista completa de sistemas tácticos (1-4-4-2, 1-4-3-3, 1-3-5-2, 1-5-3-2, etc.).
- Selector de **Posición** por cada jugador (POR, DFD, DFC, DFI, MCD, MC, MCO, ED, EI, DC, etc).
- Selector **Titular / Banquillo**.
- Si es "Banquillo", mostrar un selector desplegable "Entró por:" (mostrando a los titulares) y un input "Minuto:".
- Mantenemos los inputs de Minutos, Goles, Asistencias y Tarjetas (Amarilla/Roja).
- Componente de **Valoración por Estrellas** visual e interactivo (1 al 5).
- Input de texto para **Comentarios Breves** del entrenador sobre su rendimiento.

## Verification Plan
1. Ejecutar el SQL actualizado en Supabase.
2. Probar a crear un partido escribiendo un rival que no existe, añadiendo un escudo personalizado, y guardando.
3. Abrir el partido, probar el modal completo de Pasar Datos (titulares, suplentes, sustituciones, estrellas, comentarios, sistema táctico).
4. Verificar que todo persiste correctamente al refrescar.
