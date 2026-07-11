const fs = require('fs');

const formationsFile = '/Users/victorzandal/Proyectos/App-UD-Atzeneta/src/utils/formations.ts';
let content = fs.readFileSync(formationsFile, 'utf8');

const mapRoleToFull = (role, x) => {
    switch (role) {
        case 'GK': return 'Portero';
        case 'LI': return 'Lateral Izquierdo';
        case 'LD': return 'Lateral Derecho';
        case 'DFC':
            if (x < 45) return 'Central Izquierdo';
            if (x > 55) return 'Central Derecho';
            return 'Central';
        case 'MCD':
            if (x < 45) return 'Pivote Izquierdo';
            if (x > 55) return 'Pivote Derecho';
            return 'Pivote';
        case 'MC':
            if (x < 45) return 'Medio Izquierdo';
            if (x > 55) return 'Medio Derecho';
            return 'Mediocentro';
        case 'MI': return 'Interior Izquierdo';
        case 'MD': return 'Interior Derecho';
        case 'MCO': return 'Mediapunta';
        case 'MP':
            if (x < 50) return 'Mediapunta Izquierdo';
            if (x > 50) return 'Mediapunta Derecho';
            return 'Mediapunta';
        case 'DC':
            if (x < 45) return 'Delantero Izquierdo';
            if (x > 55) return 'Delantero Derecho';
            return 'Delantero Centro';
        case 'EI': return 'Extremo Izquierdo';
        case 'ED': return 'Extremo Derecho';
        default: return role;
    }
};

content = content.replace(/\{ role: '([^']+)', x: (\d+), y: (\d+) \}/g, (match, role, x, y) => {
    const fullRole = mapRoleToFull(role, parseInt(x, 10));
    return `{ label: '${role}', role: '${fullRole}', x: ${x}, y: ${y} }`;
});

content = content.replace(
  "export const FORMATIONS_SLOTS: Record<string, { role: string; x: number; y: number }[]> = {",
  "export const FORMATIONS_SLOTS: Record<string, { label: string; role: string; x: number; y: number }[]> = {"
);

fs.writeFileSync(formationsFile, content);
console.log('formations.ts updated!');
