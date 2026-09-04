export function calculateImpact(points=0){return {carbonKg:+(points*.018).toFixed(1),waterLitres:Math.round(points*.45)}}
