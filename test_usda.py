import urllib.request
import zipfile
import csv
import os

url = 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_csv_2024-04-18.zip'
zip_path = 'foundation.zip'
extract_dir = 'foundation_csv'
inner_dir = f'{extract_dir}/FoodData_Central_foundation_food_csv_2024-04-18'

print("Downloading...")
urllib.request.urlretrieve(url, zip_path)

print("Extracting...")
with zipfile.ZipFile(zip_path, 'r') as zip_ref:
    zip_ref.extractall(extract_dir)

# Read foods
foods = {} # fdc_id -> description
with open(f"{inner_dir}/food.csv", encoding='utf-8') as f:
    reader = csv.reader(f)
    headers = next(reader)
    for row in reader:
        fdc_id = row[0]
        desc = row[2]
        foods[fdc_id] = {'name': desc, 'cal': 0, 'pro': 0, 'carb': 0, 'fat': 0}

# Read nutrients
# nutrient IDs: 1008 = energy(kcal), 1003 = protein(g), 1005 = carb(g), 1004 = fat(g)
with open(f"{inner_dir}/food_nutrient.csv", encoding='utf-8') as f:
    reader = csv.reader(f)
    headers = next(reader)
    for row in reader:
        fdc_id = row[1]
        nutrient_id = row[2]
        amount = float(row[3]) if row[3] else 0
        if fdc_id in foods:
            if nutrient_id == '1008':
                foods[fdc_id]['cal'] = round(amount)
            elif nutrient_id == '1003':
                foods[fdc_id]['pro'] = round(amount)
            elif nutrient_id == '1005':
                foods[fdc_id]['carb'] = round(amount)
            elif nutrient_id == '1004':
                foods[fdc_id]['fat'] = round(amount)

# Write to our own CSV
with open('global_foods.csv', 'w', newline='', encoding='utf-8') as f:
    writer = csv.writer(f)
    writer.writerow(['fdc_id', 'name', 'cal', 'pro', 'carb', 'fat'])
    count = 0
    for fdc_id, data in foods.items():
        if data['cal'] > 0 or data['pro'] > 0: # Only write if it has macros
            writer.writerow([fdc_id, data['name'], data['cal'], data['pro'], data['carb'], data['fat']])
            count += 1
            
print(f"Done. Wrote {count} foods to global_foods.csv")
