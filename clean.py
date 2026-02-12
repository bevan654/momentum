import json
import pandas as pd
from collections import defaultdict

# Read the TSV file
df = pd.read_csv('mfp-diaries.tsv', sep='\t', header=None)

# Define column names based on your data structure
# Assuming columns are: user_id, date, meals_data, totals_data
df.columns = ['user_id', 'date', 'meals_data', 'totals_data']

# Dictionary to store unique food items with their nutritional info
unique_foods = defaultdict(list)

# Process each row
for index, row in df.iterrows():
    try:
        # Parse the meals JSON data
        meals = json.loads(row['meals_data'])
        
        # Iterate through meals (assuming each row has one meal with multiple dishes)
        for meal in meals:
            if 'dishes' in meal:
                for dish in meal['dishes']:
                    food_name = dish['name']
                    
                    # Extract nutritional info
                    nutritions = {}
                    for nutrient in dish['nutritions']:
                        # Clean up nutrient values (remove commas from numbers)
                        try:
                            value = float(nutrient['value'].replace(',', ''))
                        except:
                            value = nutrient['value']
                        nutritions[nutrient['name']] = value
                    
                    # Add to unique foods dictionary
                    # Store as tuple of (nutrition_dict, count) to track occurrences
                    found = False
                    for i, (existing_nutritions, count) in enumerate(unique_foods[food_name]):
                        if existing_nutritions == nutritions:
                            unique_foods[food_name][i] = (existing_nutritions, count + 1)
                            found = True
                            break
                    
                    if not found:
                        unique_foods[food_name].append((nutritions, 1))
                        
    except Exception as e:
        print(f"Error processing row {index}: {e}")

# Print summary
print(f"Total unique food items: {len(unique_foods)}\n")


'''
# Print all unique food items with their nutritional information
for food_name, nutritions_list in sorted(unique_foods.items()):
    print(f"\n{'='*80}")
    print(f"Food: {food_name}")
    print(f"Number of unique nutritional profiles: {len(nutritions_list)}")
    
    for i, (nutritions, count) in enumerate(nutritions_list):
        if len(nutritions_list) > 1:
            print(f"\n  Nutritional Profile #{i+1} (found {count} time(s)):")
        else:
            print(f"\n  Nutritional Information (found {count} time(s)):")
        
        # Print nutrients in a consistent order
        nutrient_order = ['Calories', 'Carbs', 'Fat', 'Protein', 'Sodium', 'Sugar']
        for nutrient in nutrient_order:
            if nutrient in nutritions:
                value = nutritions[nutrient]
                print(f"    {nutrient}: {value}")
'''
# Optionally save to CSV
def save_to_csv(unique_foods, filename='unique_foods_nutrition.csv'):
    """Save unique foods data to a CSV file"""
    data = []
    for food_name, nutritions_list in unique_foods.items():
        for i, (nutritions, count) in enumerate(nutritions_list):
            row = {
                'Food Name': food_name,
                'Profile #': i+1 if len(nutritions_list) > 1 else 1,
                'Occurrences': count
            }
            # Add all nutrient values
            for nutrient_name, value in nutritions.items():
                row[nutrient_name] = value
            data.append(row)
    
    df_output = pd.DataFrame(data)
    df_output.to_csv(filename, index=False)
    print(f"\nData saved to {filename}")
    return df_output

# Uncomment to save to CSV
# output_df = save_to_csv(unique_foods)

# For a simpler version - just the unique food names
'''
print(f"\n{'='*80}")
print("SIMPLE VERSION - JUST UNIQUE FOOD NAMES:")
print("="*80)
for i, food_name in enumerate(sorted(unique_foods.keys()), 1):
    print(f"{i:3}. {food_name}")'''

save_to_csv(unique_foods)