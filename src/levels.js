export const levels = [
  {
    id: 1,
    name: "Warm Exit",
    grid: { cols: 6, rows: 6 },
    exit: { side: "right", row: 2 },
    starMoves: [4, 7],
    cars: [
      { id: "red", color: "#e74646", x: 1, y: 2, length: 2, orientation: "h", target: true },
      { id: "blue", color: "#3482f6", x: 4, y: 0, length: 2, orientation: "v" },
      { id: "green", color: "#31a66a", x: 0, y: 0, length: 2, orientation: "h" },
      { id: "yellow", color: "#f3c74f", x: 2, y: 4, length: 3, orientation: "h" },
      { id: "violet", color: "#8962d9", x: 5, y: 3, length: 2, orientation: "v" }
    ],
    barriers: [{ x: 3, y: 1 }]
  },
  {
    id: 2,
    name: "Side Street",
    grid: { cols: 6, rows: 6 },
    exit: { side: "right", row: 2 },
    starMoves: [7, 12],
    cars: [
      { id: "red", color: "#e74646", x: 0, y: 2, length: 2, orientation: "h", target: true },
      { id: "a", color: "#3482f6", x: 2, y: 0, length: 3, orientation: "v" },
      { id: "b", color: "#31a66a", x: 3, y: 3, length: 2, orientation: "v" },
      { id: "c", color: "#f3c74f", x: 4, y: 1, length: 2, orientation: "h" },
      { id: "d", color: "#8962d9", x: 0, y: 5, length: 3, orientation: "h" }
    ],
    barriers: [{ x: 5, y: 4 }]
  },
  {
    id: 3,
    name: "Tiny Queue",
    grid: { cols: 6, rows: 6 },
    exit: { side: "right", row: 2 },
    starMoves: [9, 15],
    cars: [
      { id: "red", color: "#e74646", x: 1, y: 2, length: 2, orientation: "h", target: true },
      { id: "a", color: "#3482f6", x: 3, y: 1, length: 2, orientation: "v" },
      { id: "b", color: "#31a66a", x: 4, y: 2, length: 2, orientation: "v" },
      { id: "c", color: "#f3c74f", x: 0, y: 0, length: 3, orientation: "v" },
      { id: "d", color: "#8962d9", x: 2, y: 5, length: 3, orientation: "h" },
      { id: "e", color: "#35aab0", x: 5, y: 0, length: 2, orientation: "v" }
    ],
    barriers: []
  },
  {
    id: 4,
    name: "Corner Lot",
    grid: { cols: 6, rows: 6 },
    exit: { side: "right", row: 3 },
    starMoves: [10, 17],
    cars: [
      { id: "red", color: "#e74646", x: 0, y: 3, length: 2, orientation: "h", target: true },
      { id: "a", color: "#3482f6", x: 2, y: 1, length: 3, orientation: "v" },
      { id: "b", color: "#31a66a", x: 3, y: 3, length: 2, orientation: "h" },
      { id: "c", color: "#f3c74f", x: 4, y: 0, length: 2, orientation: "v" },
      { id: "d", color: "#8962d9", x: 0, y: 0, length: 2, orientation: "h" },
      { id: "e", color: "#35aab0", x: 5, y: 4, length: 2, orientation: "v" }
    ],
    barriers: [{ x: 1, y: 5 }]
  },
  {
    id: 5,
    name: "Double Parked",
    grid: { cols: 6, rows: 6 },
    exit: { side: "right", row: 2 },
    starMoves: [12, 20],
    cars: [
      { id: "red", color: "#e74646", x: 0, y: 2, length: 2, orientation: "h", target: true },
      { id: "a", color: "#3482f6", x: 2, y: 0, length: 2, orientation: "v" },
      { id: "b", color: "#31a66a", x: 3, y: 1, length: 3, orientation: "v" },
      { id: "c", color: "#f3c74f", x: 4, y: 2, length: 2, orientation: "v" },
      { id: "d", color: "#8962d9", x: 0, y: 4, length: 3, orientation: "h" },
      { id: "e", color: "#35aab0", x: 3, y: 5, length: 3, orientation: "h" }
    ],
    barriers: [{ x: 5, y: 0 }]
  },
  {
    id: 6,
    name: "Gate Shift",
    grid: { cols: 6, rows: 6 },
    exit: { side: "right", row: 1 },
    starMoves: [13, 22],
    cars: [
      { id: "red", color: "#e74646", x: 1, y: 1, length: 2, orientation: "h", target: true },
      { id: "a", color: "#3482f6", x: 3, y: 0, length: 3, orientation: "v" },
      { id: "b", color: "#31a66a", x: 5, y: 2, length: 3, orientation: "v" },
      { id: "c", color: "#f3c74f", x: 0, y: 3, length: 2, orientation: "v" },
      { id: "d", color: "#8962d9", x: 1, y: 5, length: 3, orientation: "h" },
      { id: "e", color: "#35aab0", x: 4, y: 5, length: 2, orientation: "h" }
    ],
    barriers: [{ x: 0, y: 0 }, { x: 2, y: 3 }]
  },
  {
    id: 7,
    name: "Packed Row",
    grid: { cols: 6, rows: 6 },
    exit: { side: "right", row: 3 },
    starMoves: [15, 25],
    cars: [
      { id: "red", color: "#e74646", x: 1, y: 3, length: 2, orientation: "h", target: true },
      { id: "a", color: "#3482f6", x: 3, y: 2, length: 2, orientation: "v" },
      { id: "b", color: "#31a66a", x: 4, y: 0, length: 3, orientation: "v" },
      { id: "c", color: "#f3c74f", x: 0, y: 0, length: 2, orientation: "v" },
      { id: "d", color: "#8962d9", x: 0, y: 5, length: 2, orientation: "h" },
      { id: "e", color: "#35aab0", x: 2, y: 0, length: 2, orientation: "h" },
      { id: "f", color: "#ef7d3c", x: 5, y: 3, length: 2, orientation: "v" }
    ],
    barriers: []
  },
  {
    id: 8,
    name: "Narrow Lane",
    grid: { cols: 6, rows: 6 },
    exit: { side: "right", row: 2 },
    starMoves: [16, 28],
    cars: [
      { id: "red", color: "#e74646", x: 0, y: 2, length: 2, orientation: "h", target: true },
      { id: "a", color: "#3482f6", x: 2, y: 1, length: 3, orientation: "v" },
      { id: "b", color: "#31a66a", x: 3, y: 0, length: 2, orientation: "h" },
      { id: "c", color: "#f3c74f", x: 4, y: 2, length: 2, orientation: "v" },
      { id: "d", color: "#8962d9", x: 5, y: 4, length: 2, orientation: "v" },
      { id: "e", color: "#35aab0", x: 0, y: 5, length: 3, orientation: "h" }
    ],
    barriers: [{ x: 1, y: 0 }, { x: 3, y: 5 }]
  },
  {
    id: 9,
    name: "Late Valet",
    grid: { cols: 6, rows: 6 },
    exit: { side: "right", row: 4 },
    starMoves: [18, 30],
    cars: [
      { id: "red", color: "#e74646", x: 1, y: 4, length: 2, orientation: "h", target: true },
      { id: "a", color: "#3482f6", x: 3, y: 3, length: 3, orientation: "v" },
      { id: "b", color: "#31a66a", x: 4, y: 1, length: 2, orientation: "v" },
      { id: "c", color: "#f3c74f", x: 0, y: 0, length: 3, orientation: "v" },
      { id: "d", color: "#8962d9", x: 1, y: 2, length: 3, orientation: "h" },
      { id: "e", color: "#35aab0", x: 4, y: 5, length: 2, orientation: "h" }
    ],
    barriers: [{ x: 5, y: 0 }, { x: 2, y: 0 }]
  },
  {
    id: 10,
    name: "Rush Hourlet",
    grid: { cols: 6, rows: 6 },
    exit: { side: "right", row: 2 },
    starMoves: [20, 34],
    cars: [
      { id: "red", color: "#e74646", x: 0, y: 2, length: 2, orientation: "h", target: true },
      { id: "a", color: "#3482f6", x: 2, y: 0, length: 3, orientation: "v" },
      { id: "b", color: "#31a66a", x: 3, y: 2, length: 2, orientation: "v" },
      { id: "c", color: "#f3c74f", x: 4, y: 0, length: 2, orientation: "h" },
      { id: "d", color: "#8962d9", x: 5, y: 2, length: 3, orientation: "v" },
      { id: "e", color: "#35aab0", x: 0, y: 5, length: 3, orientation: "h" },
      { id: "f", color: "#ef7d3c", x: 1, y: 3, length: 2, orientation: "h" }
    ],
    barriers: [{ x: 0, y: 0 }, { x: 4, y: 5 }]
  }
];
