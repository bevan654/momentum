import requests
import json
import time
import re

LM_STUDIO_URL = "http://localhost:1234/v1/chat/completions"
HEADERS = {"Content-Type": "application/json"}

# Your existing foods (simplified list for checking)
EXISTING_FOODS = [
    "Chicken Breast (Raw, Boneless, Skinless)",
    "Turkey Breast (Ground, 99% Lean)",
    "Salmon (Atlantic, Raw)",
    "Greek Yogurt (Non-Fat, Plain)",
    "Oats (Rolled, Dry)",
    "Brown Rice (Raw)",
    "Almonds (Raw)",
    "Whey Protein Isolate",
    "Broccoli (Raw)",
    "Tofu (Extra Firm)"
]

def escape_sql_string(text):
    """Properly escape SQL strings"""
    if text is None:
        return ''
    # Escape single quotes by doubling them
    return text.replace("'", "''")

def query_llm(prompt):
    payload = {
        "model": "local-model",
        "messages": [
            {
                "role": "system", 
                "content": """You are a fitness nutrition expert. Generate unique gym foods.
                For each food, provide JSON with: name, brand, calories, protein(g), carbs(g), fat(g), fiber(g), sugar(g), serving_size, serving_unit, category.
                Be specific with brands and realistic nutritional values."""
            },
            {"role": "user", "content": prompt}
        ],
        "max_tokens": 1000,
        "temperature": 0.8
    }
    
    response = requests.post(LM_STUDIO_URL, headers=HEADERS, json=payload)
    return response.json()["choices"][0]["message"]["content"]

def clean_numeric_value(value, default=0):
    """Clean and convert numeric values"""
    if value is None:
        return default
    try:
        # Remove any non-numeric characters except decimal point
        cleaned = re.sub(r'[^\d.]', '', str(value))
        if cleaned:
            return float(cleaned)
        return default
    except:
        return default

def main():
    print("Starting continuous gym food generation...")
    print("Press Ctrl+C to stop when no more foods are being generated.")
    print("-" * 60)
    
    generated_foods = []
    existing_names = set(EXISTING_FOODS)
    
    iteration = 0
    max_empty_iterations = 10
    empty_iterations = 0
    
    while empty_iterations < max_empty_iterations:
        iteration += 1
        print(f"\n📋 Iteration {iteration}")
        
        # Create a diverse prompt each time
        categories = ["High-protein snacks", "Pre-workout meals", "Post-workout recovery", 
                     "Low-carb options", "Vegan fitness foods", "Bulking foods", "Cutting foods"]
        
        prompt = f"""Generate 10 COMPLETELY NEW gym foods in the category: {categories[iteration % len(categories)]}
        
        These must be foods that serious weightlifters and bodybuilders actually eat, but aren't in basic food databases.
        Include specific product names and brands.
        
        Format each as JSON:
        {{
          "name": "Specific Food Name with details",
          "brand": "Brand Name",
          "calories": number,
          "protein": number,
          "carbs": number,
          "fat": number,
          "fiber": number,
          "sugar": number,
          "serving_size": number,
          "serving_unit": "g/ml/etc",
          "category": "Category Name"
        }}
        
        Generate 10 unique items:"""
        
        try:
            print("  Querying LLM...")
            response = query_llm(prompt)
            
            # Try to parse JSON from response
            lines = response.strip().split('\n')
            new_count = 0
            
            for line in lines:
                line = line.strip()
                if line.startswith('{') and line.endswith('}'):
                    try:
                        food = json.loads(line)
                        food_name = food.get('name', '').strip()
                        
                        if food_name and food_name not in existing_names:
                            # Clean and validate all values
                            cleaned_food = {
                                'name': food_name,
                                'brand': food.get('brand', 'Generic').strip(),
                                'calories': clean_numeric_value(food.get('calories'), 0),
                                'protein': clean_numeric_value(food.get('protein'), 0),
                                'carbs': clean_numeric_value(food.get('carbs'), 0),
                                'fat': clean_numeric_value(food.get('fat'), 0),
                                'fiber': clean_numeric_value(food.get('fiber'), 0),
                                'sugar': clean_numeric_value(food.get('sugar'), 0),
                                'serving_size': clean_numeric_value(food.get('serving_size'), 100),
                                'serving_unit': food.get('serving_unit', 'g').strip(),
                                'category': food.get('category', 'Unknown').strip(),
                                'confidence': 'estimated',
                                'popularity': 50
                            }
                            
                            generated_foods.append(cleaned_food)
                            existing_names.add(food_name)
                            new_count += 1
                            
                            print(f"  ✓ {food_name[:50]}...")
                    except Exception as e:
                        print(f"  ✗ Error parsing: {e}")
                        continue
            
            if new_count > 0:
                empty_iterations = 0
                print(f"  Added {new_count} new foods")
            else:
                empty_iterations += 1
                print(f"  No new foods this iteration ({empty_iterations}/{max_empty_iterations})")
            
            # Save progress every 5 iterations
            if iteration % 5 == 0 and generated_foods:
                with open(f'generated_foods_iter_{iteration}.json', 'w') as f:
                    json.dump(generated_foods, f, indent=2)
                print(f"  💾 Saved checkpoint with {len(generated_foods)} foods")
            
            # Rate limiting
            time.sleep(2)
            
        except KeyboardInterrupt:
            print("\n\nStopped by user.")
            break
        except Exception as e:
            print(f"  Error: {e}")
            time.sleep(3)
    
    # Final output
    print(f"\n{'='*60}")
    print(f"GENERATION COMPLETE")
    print(f"{'='*60}")
    print(f"\nTotal unique foods generated: {len(generated_foods)}")
    
    if generated_foods:
        # Generate SQL with proper escaping
        sql_lines = []
        for food in generated_foods:
            sql = f"('{escape_sql_string(food['name'])}', '{escape_sql_string(food['brand'])}', {food['calories']}, {food['protein']}, {food['carbs']}, {food['fat']}, {food['fiber']}, {food['sugar']}, {food['serving_size']}, '{escape_sql_string(food['serving_unit'])}', '{escape_sql_string(food['confidence'])}', {food['popularity']}, '{escape_sql_string(food['category'])}'),"
            sql_lines.append(sql)
        
        sql_output = """INSERT INTO public.food_catalog (
  name, 
  brand, 
  calories, 
  protein, 
  carbs, 
  fat, 
  fiber, 
  sugar, 
  serving_size, 
  serving_unit, 
  confidence, 
  popularity, 
  category
) VALUES 
""" + "\n".join(sql_lines)
        
        # Remove the last comma and add semicolon
        sql_output = sql_output.rstrip(',') + ";"
        
        # Save SQL file
        with open('generated_foods.sql', 'w', encoding='utf-8') as f:
            f.write(sql_output)
        
        # Save JSON for reference
        with open('generated_foods.json', 'w', encoding='utf-8') as f:
            json.dump(generated_foods, f, indent=2, ensure_ascii=False)
        
        print(f"\n💾 Files saved:")
        print(f"  - generated_foods.sql (SQL INSERT statements)")
        print(f"  - generated_foods.json (JSON format)")
        
        # Show some stats
        categories = {}
        for food in generated_foods:
            cat = food['category']
            categories[cat] = categories.get(cat, 0) + 1
        
        print(f"\n📊 Category breakdown:")
        for cat, count in sorted(categories.items(), key=lambda x: x[1], reverse=True):
            print(f"  {cat}: {count} foods")
        
        # Show sample SQL
        print(f"\n📝 Sample SQL (first 3 inserts):")
        sample_sql = "INSERT INTO public.food_catalog (...) VALUES \n" + "\n".join(sql_lines[:3]) + "\n... (truncated)"
        print(sample_sql)
        
        # Show sample foods
        print(f"\n✨ Sample generated foods (first 5):")
        for i, food in enumerate(generated_foods[:5]):
            print(f"\n{i+1}. {food['name']}")
            print(f"   Brand: {food['brand']}")
            print(f"   Nutrition: {food['calories']} cal | P:{food['protein']}g | C:{food['carbs']}g | F:{food['fat']}g")
            print(f"   Fiber: {food['fiber']}g | Sugar: {food['sugar']}g")
            print(f"   Serving: {food['serving_size']}{food['serving_unit']} | Category: {food['category']}")
    
    else:
        print("\n⚠️  No new foods were generated.")

if __name__ == "__main__":
    main()