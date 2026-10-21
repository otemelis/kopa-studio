"""Compare unchanged-view CUA captures without launching a browser.
Usage: python3 compare-screenshots.py baseline.jpg current.jpg
Keep theme, viewport, URL, focus and tooltip state identical. Failures require
human inspection, never automatic baseline replacement.
"""
import json
import sys
from PIL import Image, ImageChops, ImageStat

baseline, current = (Image.open(p).convert('RGB') for p in sys.argv[1:3])
if baseline.size != current.size:
    raise SystemExit('FAIL: screenshot dimensions changed')
diff = ImageChops.difference(baseline, current)
pixels = list(diff.get_flattened_data() if hasattr(diff, 'get_flattened_data') else diff.getdata())
changed = sum(max(p) > 24 for p in pixels) / len(pixels)
mean = sum(ImageStat.Stat(diff).mean) / 3
result = {'size': baseline.size, 'changed_fraction_over_24': changed,
          'mean_absolute_channel_difference': mean,
          'pass': changed <= .01 and mean <= 1.5}
print(json.dumps(result, indent=2))
raise SystemExit(0 if result['pass'] else 1)
