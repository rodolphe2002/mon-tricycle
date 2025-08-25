// app/lib/buyoData.js
// Données des quartiers de Buyo et distances approximatives (km)

export const quartiers = [
  { name: "Buyo Cité", coords: [6.2718, -6.9943] },
  { name: "Buyo Lac", coords: [6.2760, -6.9980] },
  { name: "Belleville", coords: [6.2690, -6.9900] },
  { name: "Cité CIE", coords: [6.2650, -6.9850] },
  { name: "Aviation Extension", coords: [6.2680, -6.9800] },
  { name: "DJINANSC", coords: [6.2620, -6.9750] },
  { name: "Tchemasso", coords: [6.2600, -6.9700] },
  { name: "Nouveau Buyo", coords: [6.2718462, -6.9942696] },
];

// Distances approximatives en km (à vol d'oiseau)
export const distances = {
  "Buyo Cité": {
    "Buyo Lac": 0.56,
    "Belleville": 0.51,
    "Cité CIE": 1.16,
    "Aviation Extension": 1.58,
    "DJINANSC": 2.14,
    "Tchemasso": 2.65,
  },
  "Buyo Lac": {
    "Buyo Cité": 0.56,
    "Belleville": 0.68,
    "Cité CIE": 1.70,
    "Aviation Extension": 2.11,
    "DJINANSC": 2.69,
    "Tchemasso": 3.22,
  },
  "Belleville": {
    "Buyo Cité": 0.51,
    "Buyo Lac": 0.68,
    "Cité CIE": 0.74,
    "Aviation Extension": 1.19,
    "DJINANSC": 1.74,
    "Tchemasso": 2.25,
  },
  "Cité CIE": {
    "Buyo Cité": 1.16,
    "Buyo Lac": 1.70,
    "Belleville": 0.74,
    "Aviation Extension": 0.61,
    "DJINANSC": 1.16,
    "Tchemasso": 1.67,
  },
  "Aviation Extension": {
    "Buyo Cité": 1.58,
    "Buyo Lac": 2.11,
    "Belleville": 1.19,
    "Cité CIE": 0.61,
    "DJINANSC": 0.58,
    "Tchemasso": 1.08,
  },
  "DJINANSC": {
    "Buyo Cité": 2.14,
    "Buyo Lac": 2.69,
    "Belleville": 1.74,
    "Cité CIE": 1.16,
    "Aviation Extension": 0.58,
    "Tchemasso": 0.51,
  },
  "Tchemasso": {
    "Buyo Cité": 2.65,
    "Buyo Lac": 3.22,
    "Belleville": 2.25,
    "Cité CIE": 1.67,
    "Aviation Extension": 1.08,
    "DJINANSC": 0.51,
  },
};
