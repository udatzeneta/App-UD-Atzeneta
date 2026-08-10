import re

with open('src/pages/Matches.tsx', 'r') as f:
    content = f.read()

# 1. Extract the <svg> block
svg_match = re.search(r'(\s*)<svg width="130" height="220".*?<\/svg>', content, re.DOTALL)
if not svg_match:
    print("SVG not found")
    exit(1)

svg_code = svg_match.group(0).strip()

# 2. Create the KitMannequin component
component_code = f"""
const KitMannequin = ({{ kitShirtColor, kitShortsColor, kitSocksColor }}: {{ kitShirtColor: string; kitShortsColor: string; kitSocksColor: string }}) => (
  {svg_code}
);

export const Matches: React.FC = () => {{
"""

# Replace export const Matches with the component + export const Matches
content = content.replace('export const Matches: React.FC = () => {', component_code)

# 3. Replace the SVG in edit mode
content = content.replace(svg_match.group(0), '                  <KitMannequin kitShirtColor={kitShirtColor} kitShortsColor={kitShortsColor} kitSocksColor={kitSocksColor} />')

# 4. Replace the circles in view mode
circles_code = """<div className="flex gap-4 items-center">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full border border-brand-black-border" style={{backgroundColor: kitShirtColor}}></span>
                    <span className="text-xs text-brand-gray-muted">Camiseta</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full border border-brand-black-border" style={{backgroundColor: kitShortsColor}}></span>
                    <span className="text-xs text-brand-gray-muted">Pantalón</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full border border-brand-black-border" style={{backgroundColor: kitSocksColor}}></span>
                    <span className="text-xs text-brand-gray-muted">Medias</span>
                  </div>
                </div>"""

new_view_code = """<div className="flex justify-center scale-75 origin-top -mb-10">
                  <KitMannequin kitShirtColor={kitShirtColor} kitShortsColor={kitShortsColor} kitSocksColor={kitSocksColor} />
                </div>"""

content = content.replace(circles_code, new_view_code)

with open('src/pages/Matches.tsx', 'w') as f:
    f.write(content)

print("Patched successfully")
