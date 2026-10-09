"""Encode generated alpha atlases and describe their islands for SVG rigging.

Does not repaint, resize or composite artwork. The small analysis-only alpha
grid identifies the generated body and detached paws; SVG clips each island
from the same unmodified, full-resolution image at runtime.
"""
import hashlib
import json
import sys
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
inputs = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8-sig'))
result = {}
for kind, source in inputs.items():
    with Image.open(source).convert('RGBA') as original:
        width, height = original.size
        alpha = original.getchannel('A').resize((256, 256))
        pixels = alpha.load()
        seen = set()
        islands = []
        for y in range(256):
            for x in range(256):
                if (x, y) in seen or pixels[x, y] < 24:
                    continue
                points, stack = [], [(x, y)]
                seen.add((x, y))
                while stack:
                    point = stack.pop()
                    points.append(point)
                    px, py = point
                    for nx, ny in ((px-1,py),(px+1,py),(px,py-1),(px,py+1)):
                        if 0 <= nx < 256 and 0 <= ny < 256 and (nx,ny) not in seen and pixels[nx,ny] >= 24:
                            seen.add((nx,ny))
                            stack.append((nx,ny))
                if len(points) > 120:
                    islands.append(points)
        islands.sort(key=len, reverse=True)
        if len(islands) < 3:
            raise ValueError(f'{kind}: expected body and two isolated paws; found {len(islands)}')
        body = islands[0]
        paws = sorted(islands[1:3], key=lambda pts: sum(x for x,y in pts)/len(pts))

        def describe(points):
            rows = {}
            for x, y in points:
                rows.setdefault(y, []).append(x)
            # Half a grid pixel of margin retains the fuzzy generated alpha edge.
            left = [(min(xs)-.65, y-.5) for y,xs in sorted(rows.items())]
            right = [(max(xs)+1.65, y+.5) for y,xs in sorted(rows.items(), reverse=True)]
            scale = lambda p: (round(p[0]*width/256,1), round(p[1]*height/256,1))
            contour = [scale(p) for p in left+right]
            path = 'M'+'L'.join(f'{x},{y}' for x,y in contour)+'Z'
            xs,ys = zip(*contour)
            return {'box':[min(xs),min(ys),round(max(xs)-min(xs),1),round(max(ys)-min(ys),1)], 'clip':path}

        # Format compression only: same resolution and generated alpha.
        digest = hashlib.sha256(Path(source).read_bytes()).hexdigest()[:12]
        name = f'{kind}-{digest}.webp'
        destination = root/'public'/'mascots'/name
        original.save(destination, 'WEBP', quality=89, method=6, exact=True)
        result[kind] = {'src':f'/mascots/{name}', 'width':width, 'height':height,
                        'body':describe(body), 'left':describe(paws[0]), 'right':describe(paws[1])}
        print(f'{kind}: {width}x{height}, {destination.stat().st_size//1024} KiB, {len(islands)} alpha islands')
(root/'src'/'plushMascots.json').write_text(json.dumps(result,separators=(',',':')),encoding='utf-8')
