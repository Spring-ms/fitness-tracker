// Rough average calorie estimates for common foods, used to help fill in
// a calorie value when the user doesn't know the exact number.
const COMMON_FOODS = {
  "Banana": 105,
  "Apple": 95,
  "Orange": 62,
  "Egg (large)": 78,
  "Bread slice (white)": 80,
  "Bread slice (whole wheat)": 70,
  "Chicken breast (100g, cooked)": 165,
  "Ground beef (100g, cooked)": 250,
  "Salmon (100g, cooked)": 208,
  "Rice, white (1 cup cooked)": 205,
  "Rice, brown (1 cup cooked)": 216,
  "Pasta (1 cup cooked)": 220,
  "Oatmeal (1 cup cooked)": 150,
  "Potato, baked (medium)": 160,
  "Avocado (whole)": 240,
  "Peanut butter (1 tbsp)": 95,
  "Almonds (1 oz, ~23 nuts)": 165,
  "Yogurt, plain (1 cup)": 150,
  "Yogurt, Greek (1 cup)": 130,
  "Milk, whole (1 cup)": 150,
  "Cheese, cheddar (1 oz)": 115,
  "Salad, mixed greens (no dressing)": 20,
  "Pizza slice (cheese)": 285,
  "Burger (fast food)": 550,
  "French fries (medium)": 365,
  "Coffee, black": 5,
  "Coffee with milk & sugar": 60,
  "Protein shake": 150,
  "Granola bar": 140,
  "Chocolate bar": 210,
  "Soda (12 oz can)": 150,
  "Beer (12 oz)": 150,
  "Wine (5 oz glass)": 125,
};

function estimateCaloriesFor(foodName) {
  if (!foodName) return null;
  const exact = COMMON_FOODS[foodName];
  if (exact !== undefined) return exact;
  const needle = foodName.trim().toLowerCase();
  if (!needle) return null;
  const match = Object.keys(COMMON_FOODS).find(
    (name) => name.toLowerCase() === needle
  );
  return match ? COMMON_FOODS[match] : null;
}
