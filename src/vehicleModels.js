export function vehicleModel(car) {
  if (car.id === "target") return { kind: "racer", name: "跑車" };
  const hex = car.color.replace("#", "");
  const rgb = [0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const [r, g, b] = rgb, max = Math.max(...rgb), min = Math.min(...rgb);
  const hue = max === min ? 0 : ((max === r ? (g - b) / (max - min) : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4) * 60 + 360) % 360;
  if (car.len === 3) {
    if (hue < 75) return { kind: "schoolbus", name: "校車" };
    if (hue < 180) return { kind: "camper", name: "露營車" };
    if (hue < 250) return { kind: "coach", name: "城市巴士" };
    return { kind: "delivery", name: "貨運卡車" };
  }
  if (hue < 55) return { kind: "pickup", name: "皮卡" };
  if (hue < 170) return { kind: "jeep", name: "越野車" };
  if (hue < 250) return { kind: "compact", name: "小轎車" };
  return { kind: "taxi", name: "計程車" };
}


