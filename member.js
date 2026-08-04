let macroChartInstance = null;
let weightChartInstance = null;
window.currentFoodLogs = [];
window.currentWeightLogs = [];

window.deleteWeight = async function(id) {
    if (!confirm('Are you sure you want to delete this weight log?')) return;
    try {
        const res = await fetch(`/api/weight/${id}`, { method: 'DELETE' });
        if (res.ok) {
            window.location.reload();
        } else {
            alert('Failed to delete weight log.');
        }
    } catch (err) {
        console.error(err);
    }
};

window.editWeight = function(id) {
    const log = window.currentWeightLogs.find(w => w.id === id);
    if (!log) return;
    document.getElementById('edit-weight-id').value = log.id;
    document.getElementById('weight-value').value = log.weight;
    document.getElementById('weight-submit-btn').innerText = 'Update Weight';
    document.getElementById('cancel-weight-edit-btn').style.display = 'inline-block';
    document.getElementById('weight-form').scrollIntoView({ behavior: 'smooth' });
};

window.cancelWeightEdit = function() {
    document.getElementById('edit-weight-id').value = '';
    document.getElementById('weight-submit-btn').innerText = 'Log Weight';
    document.getElementById('cancel-weight-edit-btn').style.display = 'none';
    document.getElementById('weight-form').reset();
};

window.deleteFood = async function(id) {
    if (!confirm('Are you sure you want to delete this food item?')) return;
    try {
        const res = await fetch(`/api/food/${id}`, { method: 'DELETE' });
        if (res.ok) {
            window.location.reload();
        } else {
            alert('Failed to delete food.');
        }
    } catch (err) {
        console.error(err);
    }
};

window.editFood = function(id) {
    const log = window.currentFoodLogs.find(f => f.id === id);
    if (!log) return;
    document.getElementById('edit-food-id').value = log.id;
    document.getElementById('food-meal').value = log.meal_type || 'Breakfast';
    document.getElementById('food-name').value = log.food_name;
    document.getElementById('food-cal').value = log.calories;
    document.getElementById('food-pro').value = log.protein;
    document.getElementById('food-carb').value = log.carbs;
    document.getElementById('food-fat').value = log.fat;
    document.getElementById('food-qty').value = ''; 
    document.getElementById('food-submit-btn').innerText = 'Update Food';
    document.getElementById('cancel-edit-btn').style.display = 'inline-block';
    document.getElementById('food-form').scrollIntoView({ behavior: 'smooth' });
};

window.cancelEdit = function() {
    document.getElementById('edit-food-id').value = '';
    document.getElementById('food-submit-btn').innerText = 'Log Food';
    document.getElementById('cancel-edit-btn').style.display = 'none';
    document.getElementById('food-form').reset();
};

document.addEventListener('DOMContentLoaded', () => {
    // Basic Authentication Check
    const member = JSON.parse(localStorage.getItem('fitisamust_member'));
    if (!member || !member.id) {
        window.location.href = 'index.html';
        return;
    }

    document.getElementById('welcome-message').innerText = `Welcome back, ${member.name}!`;

    // Pre-built Fitness Foods Database
    const prebuiltFoods = [
        // Basics & Lean Proteins
        { name: "Chicken Breast (4 oz)", cal: 187, pro: 35, carb: 0, fat: 4 },
        { name: "White Rice (1 cup cooked)", cal: 205, pro: 4, carb: 45, fat: 0 },
        { name: "Brown Rice (1 cup cooked)", cal: 216, pro: 5, carb: 45, fat: 2 },
        { name: "Sweet Potato (medium)", cal: 103, pro: 2, carb: 24, fat: 0 },
        { name: "Eggs (2 large)", cal: 140, pro: 12, carb: 0, fat: 10 },
        { name: "Hard Boiled Eggs (2 large)", cal: 140, pro: 12, carb: 0, fat: 10 },
        { name: "Egg Whites (1 cup)", cal: 126, pro: 26, carb: 2, fat: 0 },
        { name: "Oats (1/2 cup dry)", cal: 150, pro: 5, carb: 27, fat: 3 },
        { name: "Whey Protein (1 scoop)", cal: 120, pro: 24, carb: 3, fat: 1.5 },
        { name: "Greek Yogurt (1 cup plain)", cal: 100, pro: 17, carb: 6, fat: 0 },
        { name: "Broccoli (1 cup chopped)", cal: 31, pro: 3, carb: 6, fat: 0 },
        { name: "Peanut Butter (2 tbsp)", cal: 190, pro: 7, carb: 8, fat: 16 },
        { name: "Banana (medium)", cal: 105, pro: 1, carb: 27, fat: 0 },
        { name: "Almonds (1 oz)", cal: 164, pro: 6, carb: 6, fat: 14 },
        { name: "Salmon (4 oz)", cal: 236, pro: 22, carb: 0, fat: 15 },
        { name: "Ground Beef 93/7 (4 oz)", cal: 170, pro: 24, carb: 0, fat: 8 },
        { name: "Tuna (1 can, in water)", cal: 130, pro: 29, carb: 0, fat: 1 },
        { name: "Cottage Cheese (1/2 cup)", cal: 110, pro: 14, carb: 5, fat: 5 },
        
        // Grocery - Produce & Fruit
        { name: "Apple (medium)", cal: 95, pro: 0, carb: 25, fat: 0 },
        { name: "Avocado (1/2 medium)", cal: 160, pro: 2, carb: 9, fat: 15 },
        { name: "Spinach (1 cup raw)", cal: 7, pro: 1, carb: 1, fat: 0 },
        { name: "Mixed Berries (1 cup)", cal: 70, pro: 1, carb: 15, fat: 0 },
        { name: "Carrots (1 cup chopped)", cal: 52, pro: 1, carb: 12, fat: 0 },
        { name: "Onion (1 medium)", cal: 44, pro: 1, carb: 10, fat: 0 },
        { name: "Tomato (1 medium)", cal: 22, pro: 1, carb: 5, fat: 0 },
        
        // Grocery - Dairy & Alternatives
        { name: "Whole Milk (1 cup)", cal: 150, pro: 8, carb: 12, fat: 8 },
        { name: "Almond Milk, Unsweetened (1 cup)", cal: 30, pro: 1, carb: 1, fat: 3 },
        { name: "Cheddar Cheese (1 oz)", cal: 110, pro: 7, carb: 1, fat: 9 },
        { name: "Butter (1 tbsp)", cal: 100, pro: 0, carb: 0, fat: 11 },
        { name: "Olive Oil (1 tbsp)", cal: 119, pro: 0, carb: 0, fat: 14 },
        
        // Grocery - Pantry & Carbs
        { name: "Whole Wheat Bread (1 slice)", cal: 80, pro: 4, carb: 15, fat: 1 },
        { name: "White Bread (1 slice)", cal: 75, pro: 2, carb: 14, fat: 1 },
        { name: "Pasta (2 oz dry)", cal: 210, pro: 7, carb: 42, fat: 1 },
        { name: "Black Beans (1/2 cup canned)", cal: 110, pro: 7, carb: 20, fat: 0 },
        { name: "Quinoa (1 cup cooked)", cal: 222, pro: 8, carb: 39, fat: 4 },
        { name: "Tortilla (1 medium flour)", cal: 140, pro: 4, carb: 24, fat: 3 },
        
        // Grocery - Meats & Seafood
        { name: "Pork Chop (4 oz)", cal: 250, pro: 23, carb: 0, fat: 17 },
        { name: "Bacon (2 slices)", cal: 86, pro: 6, carb: 0, fat: 7 },
        { name: "Shrimp (4 oz cooked)", cal: 112, pro: 24, carb: 0, fat: 1 },
        { name: "Turkey Breast (4 oz sliced)", cal: 104, pro: 22, carb: 2, fat: 1 },
        
        // Name Brand Grocery Items
        { name: "Oikos Triple Zero Greek Yogurt", cal: 90, pro: 15, carb: 7, fat: 0 },
        { name: "Chobani Non-Fat Greek Yogurt", cal: 90, pro: 16, carb: 6, fat: 0 },
        { name: "Dave's Killer Bread (21 Whole Grains, 1 slice)", cal: 110, pro: 5, carb: 22, fat: 1.5 },
        { name: "Fairlife Core Power Elite (1 bottle)", cal: 230, pro: 42, carb: 9, fat: 3.5 },
        { name: "Quest Nutrition Protein Bar (Chocolate Chip)", cal: 190, pro: 21, carb: 22, fat: 8 },
        { name: "Optimum Nutrition Gold Standard Whey (1 scoop)", cal: 120, pro: 24, carb: 3, fat: 1.5 },
        { name: "Kodiak Cakes Flapjack Mix (1/2 cup)", cal: 190, pro: 14, carb: 30, fat: 2 },
        { name: "Halo Top Vanilla Bean Ice Cream (1 pint)", cal: 290, pro: 18, carb: 58, fat: 9 },
        { name: "Barilla Protein+ Pasta (2 oz)", cal: 190, pro: 10, carb: 38, fat: 1 },
        { name: "Kashi GOLEAN Cereal (1 1/4 cup)", cal: 180, pro: 12, carb: 34, fat: 1.5 },
        { name: "Thomas' Light Multi-Grain English Muffin", cal: 100, pro: 5, carb: 22, fat: 1 },
        { name: "Arnold Whole Grains 100% Whole Wheat Bread", cal: 110, pro: 4, carb: 20, fat: 1.5 },
        // More Name Brand Grocery Items - Peanut Butter
        { name: "Jif Creamy Peanut Butter (2 tbsp)", cal: 190, pro: 7, carb: 8, fat: 16 },
        { name: "Jif Crunchy Peanut Butter (2 tbsp)", cal: 190, pro: 7, carb: 8, fat: 16 },
        { name: "Jif Natural Creamy Peanut Butter (2 tbsp)", cal: 190, pro: 7, carb: 8, fat: 16 },
        { name: "Jif Reduced Fat Creamy Peanut Butter (2 tbsp)", cal: 190, pro: 8, carb: 12, fat: 12 },
        { name: "Jif No Added Sugar Creamy Peanut Butter (2 tbsp)", cal: 190, pro: 8, carb: 7, fat: 17 },
        { name: "Skippy Creamy Peanut Butter (2 tbsp)", cal: 190, pro: 7, carb: 6, fat: 16 },
        { name: "Skippy Super Chunk Peanut Butter (2 tbsp)", cal: 190, pro: 7, carb: 6, fat: 16 },
        { name: "Skippy Natural Creamy Peanut Butter (2 tbsp)", cal: 190, pro: 7, carb: 6, fat: 16 },
        { name: "Skippy Reduced Fat Creamy Peanut Butter (2 tbsp)", cal: 190, pro: 7, carb: 14, fat: 12 },
        { name: "Skippy Protein Creamy Peanut Butter (2 tbsp)", cal: 210, pro: 10, carb: 7, fat: 15 },
        { name: "Peter Pan Creamy Peanut Butter (2 tbsp)", cal: 210, pro: 8, carb: 6, fat: 17 },
        { name: "Peter Pan Crunchy Peanut Butter (2 tbsp)", cal: 210, pro: 8, carb: 6, fat: 16 },
        { name: "Smucker's Natural Creamy Peanut Butter (2 tbsp)", cal: 190, pro: 8, carb: 6, fat: 16 },
        { name: "Justin's Classic Peanut Butter (2 tbsp)", cal: 210, pro: 8, carb: 6, fat: 18 },
        { name: "Justin's Honey Peanut Butter (2 tbsp)", cal: 210, pro: 7, carb: 8, fat: 17 },
        { name: "Santa Cruz Organic Creamy Light Roasted PB (2 tbsp)", cal: 190, pro: 8, carb: 5, fat: 16 },
        { name: "Teddie All Natural Creamy Peanut Butter (2 tbsp)", cal: 190, pro: 8, carb: 7, fat: 16 },
        { name: "Crazy Richard's 100% Peanuts Creamy (2 tbsp)", cal: 190, pro: 8, carb: 5, fat: 16 },
        { name: "Peanut Butter & Co. Smooth Operator (2 tbsp)", cal: 180, pro: 7, carb: 10, fat: 14 },
        { name: "RX Nut Butter Peanut Butter (2 tbsp)", cal: 190, pro: 9, carb: 8, fat: 14 },
        { name: "Great Value Creamy Peanut Butter (2 tbsp)", cal: 190, pro: 7, carb: 8, fat: 16 },
        { name: "Kirkland Signature Organic Creamy PB (2 tbsp)", cal: 200, pro: 8, carb: 6, fat: 17 },
        { name: "Trader Joe's Creamy Salted Peanut Butter (2 tbsp)", cal: 190, pro: 8, carb: 7, fat: 16 },
        
        { name: "PBfit Peanut Butter Powder (2 tbsp)", cal: 70, pro: 8, carb: 5, fat: 2 },
        { name: "Sabra Classic Hummus (2 tbsp)", cal: 70, pro: 2, carb: 4, fat: 5 },
        
        // More Name Brand Grocery Items - Cereals & Breakfast
        { name: "Cheerios (1.5 cups)", cal: 140, pro: 5, carb: 29, fat: 2.5 },
        { name: "Honey Nut Cheerios (1 cup)", cal: 140, pro: 3, carb: 30, fat: 2 },
        { name: "Kellogg's Frosted Flakes (1 cup)", cal: 130, pro: 1, carb: 31, fat: 0 },
        { name: "Post Honey Bunches of Oats (1 cup)", cal: 160, pro: 3, carb: 33, fat: 2 },
        { name: "Quaker Oatmeal (1 packet instant)", cal: 160, pro: 4, carb: 32, fat: 2.5 },
        { name: "Pop-Tarts (2 pastries)", cal: 400, pro: 4, carb: 76, fat: 10 },
        { name: "Eggo Waffles (2 waffles)", cal: 180, pro: 4, carb: 30, fat: 5 },

        // More Name Brand Grocery Items - Oatmeal
        { name: "Quaker Old Fashioned Oats (1/2 cup dry)", cal: 150, pro: 5, carb: 27, fat: 3 },
        { name: "Quaker Quick 1-Minute Oats (1/2 cup dry)", cal: 150, pro: 5, carb: 27, fat: 2.5 },
        { name: "Quaker Steel Cut Oats (1/4 cup dry)", cal: 150, pro: 5, carb: 27, fat: 2.5 },
        { name: "Quaker Instant Oatmeal - Apples & Cinnamon (1 packet)", cal: 160, pro: 3, carb: 33, fat: 2 },
        { name: "Quaker Instant Oatmeal - Maple & Brown Sugar (1 packet)", cal: 160, pro: 4, carb: 32, fat: 2 },
        { name: "Quaker Instant Oatmeal - Original (1 packet)", cal: 100, pro: 4, carb: 19, fat: 2 },
        { name: "Quaker Protein Instant Oatmeal - Banana Nut (1 packet)", cal: 240, pro: 10, carb: 40, fat: 5 },
        { name: "Bob's Red Mill Old Fashioned Rolled Oats (1/2 cup dry)", cal: 190, pro: 7, carb: 32, fat: 3.5 },
        { name: "Bob's Red Mill Steel Cut Oats (1/4 cup dry)", cal: 170, pro: 6, carb: 29, fat: 3 },
        { name: "Bob's Red Mill GF Thick Rolled Oats (1/2 cup dry)", cal: 190, pro: 7, carb: 32, fat: 3.5 },
        { name: "Bob's Red Mill Oatmeal Cup - Apple Cinnamon (1 cup)", cal: 210, pro: 7, carb: 41, fat: 3 },
        { name: "Nature's Path Organic Old Fashioned Oats (1/2 cup dry)", cal: 150, pro: 5, carb: 27, fat: 2.5 },
        { name: "Kodiak Cakes Oatmeal - Maple and Brown Sugar (1 packet)", cal: 190, pro: 12, carb: 29, fat: 2.5 },
        { name: "Kodiak Cakes Oatmeal - Chocolate Chip (1 packet)", cal: 190, pro: 12, carb: 30, fat: 3 },
        { name: "Kodiak Cakes Oatmeal Cup - Peanut Butter Choc Chip (1 cup)", cal: 250, pro: 14, carb: 34, fat: 7 },
        { name: "McCann's Irish Oatmeal - Steel Cut (1/4 cup dry)", cal: 150, pro: 5, carb: 27, fat: 2.5 },
        { name: "RX A.M. Oats - Apple Cinnamon (1 cup)", cal: 250, pro: 12, carb: 35, fat: 8 },
        { name: "RX A.M. Oats - Maple (1 cup)", cal: 250, pro: 12, carb: 34, fat: 8 },
        { name: "Purely Elizabeth Superfood Oatmeal - Classic Cinnamon (1/3 cup dry)", cal: 160, pro: 6, carb: 27, fat: 4 },

        // More Name Brand Grocery Items - Snacks & Bars
        // Granola Bars
        { name: "Nature Valley Crunchy Oats 'n Honey (2 bars)", cal: 190, pro: 3, carb: 29, fat: 7 },
        { name: "Nature Valley Sweet & Salty Nut Peanut (1 bar)", cal: 160, pro: 4, carb: 20, fat: 7 },
        { name: "Nature Valley Protein Peanut Butter Dark Chocolate (1 bar)", cal: 190, pro: 10, carb: 14, fat: 12 },
        { name: "Quaker Chewy Chocolate Chip (1 bar)", cal: 100, pro: 1, carb: 17, fat: 3.5 },
        { name: "Quaker Chewy Peanut Butter Chocolate Chip (1 bar)", cal: 100, pro: 2, carb: 17, fat: 3.5 },
        { name: "Kellogg's Nutri-Grain Strawberry (1 bar)", cal: 130, pro: 2, carb: 24, fat: 3.5 },
        { name: "Kellogg's Nutri-Grain Apple Cinnamon (1 bar)", cal: 130, pro: 2, carb: 24, fat: 3.5 },
        { name: "Fiber One Oats & Chocolate (1 bar)", cal: 140, pro: 2, carb: 29, fat: 4 },
        { name: "Kashi Chewy Granola Bar Chocolate Almond Sea Salt (1 bar)", cal: 140, pro: 3, carb: 20, fat: 5 },
        // Whole Food / Fruit / Nut Bars
        { name: "RXBAR (Chocolate Sea Salt)", cal: 210, pro: 12, carb: 23, fat: 9 },
        { name: "RXBAR (Peanut Butter)", cal: 210, pro: 12, carb: 22, fat: 9 },
        { name: "RXBAR (Blueberry)", cal: 210, pro: 12, carb: 24, fat: 7 },
        { name: "Clif Bar (Chocolate Chip)", cal: 250, pro: 10, carb: 42, fat: 5 },
        { name: "Clif Bar (Crunch Peanut Butter)", cal: 260, pro: 11, carb: 40, fat: 7 },
        { name: "Clif Bar (White Chocolate Macadamia Nut)", cal: 260, pro: 9, carb: 42, fat: 7 },
        { name: "Kind Bar (Dark Chocolate Nuts & Sea Salt)", cal: 200, pro: 6, carb: 16, fat: 15 },
        { name: "Kind Bar (Peanut Butter Dark Chocolate)", cal: 200, pro: 8, carb: 16, fat: 13 },
        { name: "Kind Bar (Caramel Almond & Sea Salt)", cal: 200, pro: 6, carb: 15, fat: 15 },
        { name: "Lärabar (Peanut Butter Cookie)", cal: 220, pro: 6, carb: 23, fat: 12 },
        { name: "Lärabar (Apple Pie)", cal: 200, pro: 4, carb: 24, fat: 10 },
        { name: "Lärabar (Cashew Cookie)", cal: 230, pro: 6, carb: 23, fat: 13 },
        // Protein Bars
        { name: "Quest Nutrition Protein Bar (Cookies & Cream)", cal: 200, pro: 21, carb: 21, fat: 8 },
        { name: "Quest Nutrition Protein Bar (S'mores)", cal: 190, pro: 21, carb: 22, fat: 7 },
        { name: "Quest Nutrition Protein Bar (Double Chocolate Chunk)", cal: 190, pro: 20, carb: 23, fat: 7 },
        { name: "ONE Bar (Maple Glazed Doughnut)", cal: 210, pro: 20, carb: 23, fat: 7 },
        { name: "ONE Bar (Peanut Butter Pie)", cal: 220, pro: 20, carb: 22, fat: 8 },
        { name: "Pure Protein (Chocolate Peanut Butter)", cal: 200, pro: 20, carb: 16, fat: 6 },
        { name: "Pure Protein (Chewy Chocolate Chip)", cal: 200, pro: 20, carb: 17, fat: 6 },
        { name: "Think! (Brownie Crunch)", cal: 230, pro: 20, carb: 24, fat: 8 },
        { name: "Think! (Chunky Peanut Butter)", cal: 230, pro: 20, carb: 22, fat: 9 },
        { name: "Gatorade Whey Protein Bar (Chocolate Caramel)", cal: 350, pro: 20, carb: 41, fat: 13 },
        { name: "FitCrunch (Peanut Butter)", cal: 380, pro: 30, carb: 27, fat: 16 },
        { name: "FitCrunch (Chocolate Chip Cookie Dough)", cal: 380, pro: 30, carb: 27, fat: 16 },
        { name: "Barebells (Cookies & Cream)", cal: 200, pro: 20, carb: 20, fat: 7 },
        { name: "Barebells (Caramel Cashew)", cal: 200, pro: 20, carb: 17, fat: 8 },
        { name: "Cheez-It (27 crackers)", cal: 150, pro: 3, carb: 17, fat: 8 },
        { name: "Doritos Nacho Cheese (1 oz)", cal: 150, pro: 2, carb: 18, fat: 8 },
        { name: "Lay's Classic Potato Chips (1 oz)", cal: 160, pro: 2, carb: 15, fat: 10 },
        { name: "Oreos (3 cookies)", cal: 160, pro: 1, carb: 25, fat: 7 },
        { name: "Goldfish Crackers (55 pieces)", cal: 140, pro: 3, carb: 20, fat: 5 },
        { name: "SkinnyPop Popcorn (3 cups)", cal: 150, pro: 2, carb: 15, fat: 10 },

        // More Name Brand Grocery Items - Desserts & Pudding
        { name: "Jell-O Chocolate Pudding Snack (1 cup)", cal: 110, pro: 1, carb: 20, fat: 3 },
        { name: "Jell-O Vanilla Pudding Snack (1 cup)", cal: 110, pro: 1, carb: 20, fat: 3 },
        { name: "Jell-O Sugar-Free Chocolate Pudding Snack (1 cup)", cal: 60, pro: 1, carb: 10, fat: 1.5 },
        { name: "Jell-O Sugar-Free Vanilla Pudding Snack (1 cup)", cal: 60, pro: 1, carb: 10, fat: 1.5 },
        { name: "Snack Pack Chocolate Pudding (1 cup)", cal: 110, pro: 1, carb: 19, fat: 3.5 },
        { name: "Snack Pack Vanilla Pudding (1 cup)", cal: 110, pro: 0, carb: 20, fat: 3.5 },
        { name: "Snack Pack Sugar-Free Chocolate Pudding (1 cup)", cal: 70, pro: 1, carb: 11, fat: 3 },
        { name: "Kozy Shack Tapioca Pudding (1/2 cup)", cal: 130, pro: 4, carb: 21, fat: 2.5 },
        { name: "Kozy Shack Rice Pudding (1/2 cup)", cal: 130, pro: 4, carb: 21, fat: 2.5 },
        { name: "Kozy Shack Chocolate Pudding (1/2 cup)", cal: 140, pro: 4, carb: 24, fat: 2.5 },
        { name: "Swiss Miss Chocolate Pudding (1 cup)", cal: 120, pro: 1, carb: 21, fat: 3.5 },

        // More Name Brand Grocery Items - Drinks
        { name: "Gatorade Thirst Quencher (20 oz)", cal: 140, pro: 0, carb: 36, fat: 0 },
        { name: "Gatorade Zero (20 oz)", cal: 10, pro: 0, carb: 2, fat: 0 },
        { name: "Powerade (20 oz)", cal: 130, pro: 0, carb: 34, fat: 0 },
        { name: "Red Bull (8.4 oz)", cal: 110, pro: 0, carb: 28, fat: 0 },
        { name: "Monster Energy (16 oz)", cal: 210, pro: 0, carb: 54, fat: 0 },
        { name: "Celsius Energy Drink (12 oz)", cal: 10, pro: 0, carb: 2, fat: 0 },
        { name: "Muscle Milk Genuine (14 oz)", cal: 280, pro: 25, carb: 15, fat: 12 },
        { name: "Premier Protein Shake (11 oz)", cal: 160, pro: 30, carb: 5, fat: 3 },

        // More Name Brand Grocery Items - Dairy & Fridge
        { name: "Yoplait Original Yogurt (6 oz)", cal: 150, pro: 6, carb: 25, fat: 2 },
        { name: "Dannon Light & Fit Greek (5.3 oz)", cal: 80, pro: 12, carb: 9, fat: 0 },
        { name: "Tillamook Cheddar Cheese (1 oz)", cal: 110, pro: 7, carb: 1, fat: 9 },
        { name: "Babybel Original Cheese (1 piece)", cal: 70, pro: 5, carb: 0, fat: 6 },
        { name: "Philadelphia Cream Cheese (2 tbsp)", cal: 100, pro: 2, carb: 2, fat: 10 },
        { name: "Silk Almond Milk, Sweetened (1 cup)", cal: 60, pro: 1, carb: 8, fat: 2.5 },
        { name: "Oatly Oat Milk (1 cup)", cal: 120, pro: 3, carb: 16, fat: 5 },

        // More Name Brand Grocery Items - Pantry & Condiments
        { name: "Rao's Homemade Marinara Sauce (1/2 cup)", cal: 100, pro: 2, carb: 4, fat: 8 },
        { name: "Heinz Ketchup (1 tbsp)", cal: 20, pro: 0, carb: 5, fat: 0 },
        { name: "Hellmann's Real Mayonnaise (1 tbsp)", cal: 90, pro: 0, carb: 0, fat: 10 },
        { name: "Sweet Baby Ray's BBQ Sauce (2 tbsp)", cal: 70, pro: 0, carb: 18, fat: 0 },
        { name: "Hidden Valley Ranch (2 tbsp)", cal: 140, pro: 1, carb: 2, fat: 14 },
        { name: "Nutella (2 tbsp)", cal: 200, pro: 2, carb: 21, fat: 11 },
        { name: "Smucker's Strawberry Jam (1 tbsp)", cal: 50, pro: 0, carb: 13, fat: 0 },
        { name: "Kraft Macaroni & Cheese (1 cup prepared)", cal: 350, pro: 9, carb: 47, fat: 13 },
        { name: "Campbell's Chicken Noodle Soup (1/2 cup condensed)", cal: 60, pro: 3, carb: 8, fat: 2 },
        { name: "Banza Chickpea Pasta (2 oz)", cal: 190, pro: 11, carb: 35, fat: 3.5 },

        // Fast Food - Generic Burgers
        { name: "Cheeseburger", cal: 350, pro: 16, carb: 35, fat: 16 },
        { name: "Hamburger", cal: 300, pro: 13, carb: 33, fat: 12 },
        { name: "Double Cheeseburger", cal: 450, pro: 25, carb: 34, fat: 24 },

        // Fast Food - McDonald's
        { name: "McDonald's Cheeseburger", cal: 300, pro: 15, carb: 33, fat: 13 },
        { name: "McDonald's Hamburger", cal: 250, pro: 12, carb: 31, fat: 9 },
        { name: "McDonald's Double Cheeseburger", cal: 450, pro: 25, carb: 34, fat: 24 },
        { name: "McDonald's Big Mac", cal: 550, pro: 25, carb: 46, fat: 30 },
        { name: "McDonald's McDouble", cal: 400, pro: 22, carb: 33, fat: 20 },
        { name: "McDonald's Quarter Pounder with Cheese", cal: 520, pro: 30, carb: 42, fat: 26 },
        { name: "McDonald's 10 pc Chicken McNuggets", cal: 410, pro: 23, carb: 26, fat: 24 },
        { name: "McDonald's Medium Fries", cal: 320, pro: 4, carb: 43, fat: 15 },
        { name: "McDonald's Egg McMuffin", cal: 310, pro: 17, carb: 30, fat: 13 },
        { name: "McDonald's Sausage McGriddles", cal: 430, pro: 11, carb: 41, fat: 24 },
        { name: "McDonald's Sausage, Egg & Cheese McGriddles", cal: 550, pro: 19, carb: 44, fat: 33 },
        { name: "McDonald's Bacon, Egg & Cheese McGriddles", cal: 430, pro: 17, carb: 44, fat: 21 },

        // Fast Food - Taco Bell
        { name: "Taco Bell Crunchy Taco", cal: 170, pro: 8, carb: 13, fat: 9 },
        { name: "Taco Bell Bean Burrito", cal: 350, pro: 13, carb: 54, fat: 9 },
        { name: "Taco Bell Crunchwrap Supreme", cal: 530, pro: 16, carb: 71, fat: 21 },
        { name: "Taco Bell Chicken Quesadilla", cal: 510, pro: 27, carb: 38, fat: 26 },

        // Fast Food - Chipotle
        { name: "Chipotle Chicken Bowl (Standard)", cal: 720, pro: 42, carb: 71, fat: 25 },
        { name: "Chipotle Steak Burrito (Standard)", cal: 980, pro: 45, carb: 110, fat: 35 },
        { name: "Chipotle Guacamole (Side)", cal: 230, pro: 2, carb: 8, fat: 22 },

        // Fast Food - Chick-fil-A
        { name: "Chick-fil-A Chicken Sandwich", cal: 440, pro: 28, carb: 40, fat: 19 },
        { name: "Chick-fil-A Grilled Chicken Sandwich", cal: 320, pro: 28, carb: 41, fat: 6 },
        { name: "Chick-fil-A 8 ct Nuggets", cal: 250, pro: 28, carb: 11, fat: 11 },
        { name: "Chick-fil-A Waffle Fries (Medium)", cal: 420, pro: 5, carb: 45, fat: 24 },

        // Fast Food - Subway
        { name: "Subway 6\" Turkey Breast", cal: 280, pro: 18, carb: 46, fat: 4 },
        { name: "Subway 6\" Tuna", cal: 470, pro: 20, carb: 44, fat: 25 },
        { name: "Subway Footlong Spicy Italian", cal: 960, pro: 40, carb: 92, fat: 48 },

        // Drinks & Coffee
        { name: "Starbucks Grande Vanilla Latte", cal: 250, pro: 12, carb: 37, fat: 6 },
        { name: "Starbucks Grande Mocha", cal: 360, pro: 14, carb: 44, fat: 15 },
        { name: "Starbucks Grande Caramel Macchiato", cal: 250, pro: 10, carb: 35, fat: 7 },
        { name: "Starbucks Grande White Chocolate Mocha", cal: 430, pro: 15, carb: 53, fat: 18 },
        { name: "Starbucks Grande Pike Place Roast (Black)", cal: 5, pro: 0, carb: 0, fat: 0 },
        { name: "Starbucks Grande Cold Brew (Black)", cal: 5, pro: 0, carb: 0, fat: 0 },
        { name: "Starbucks Grande Iced Caramel Macchiato", cal: 250, pro: 9, carb: 37, fat: 7 },
        { name: "Starbucks Grande Iced Vanilla Latte", cal: 190, pro: 7, carb: 30, fat: 4 },
        { name: "Starbucks Grande Caffe Americano", cal: 15, pro: 1, carb: 2, fat: 0 },
        { name: "Starbucks Grande Flat White", cal: 220, pro: 12, carb: 18, fat: 11 },
        { name: "Starbucks Grande Cappuccino", cal: 140, pro: 8, carb: 12, fat: 5 },
        { name: "Starbucks Grande Matcha Green Tea Latte", cal: 240, pro: 9, carb: 34, fat: 7 },
        { name: "Starbucks Grande Chai Tea Latte", cal: 240, pro: 8, carb: 45, fat: 4 },
        { name: "Starbucks Grande Pink Drink", cal: 140, pro: 1, carb: 27, fat: 2.5 },
        { name: "Starbucks Grande Dragon Drink", cal: 130, pro: 1, carb: 26, fat: 3 },
        { name: "Starbucks Grande Iced Peach Green Tea", cal: 60, pro: 0, carb: 15, fat: 0 },
        { name: "Starbucks Grande Nitro Cold Brew", cal: 5, pro: 0, carb: 0, fat: 0 },
        { name: "Starbucks Grande Vanilla Sweet Cream Cold Brew", cal: 110, pro: 1, carb: 14, fat: 5 },
        { name: "Starbucks Grande Salted Caramel Cream Cold Brew", cal: 220, pro: 2, carb: 24, fat: 14 },
        { name: "Starbucks Grande Pumpkin Spice Latte", cal: 390, pro: 14, carb: 52, fat: 14 },
        { name: "Starbucks Grande Peppermint Mocha", cal: 440, pro: 13, carb: 63, fat: 15 },
        { name: "Starbucks Grande Caramel Frappuccino", cal: 380, pro: 4, carb: 54, fat: 16 },
        { name: "Starbucks Grande Mocha Frappuccino", cal: 370, pro: 5, carb: 51, fat: 15 },
        { name: "Starbucks Grande Vanilla Bean Frappuccino", cal: 380, pro: 5, carb: 52, fat: 16 },
        { name: "Starbucks Grande Strawberry Frappuccino", cal: 370, pro: 4, carb: 51, fat: 15 },
        { name: "Starbucks Grande Java Chip Frappuccino", cal: 440, pro: 6, carb: 60, fat: 19 },
        { name: "Starbucks Tall Hot Chocolate", cal: 280, pro: 10, carb: 34, fat: 12 },
        { name: "Starbucks Grande Hot Chocolate", cal: 370, pro: 14, carb: 43, fat: 16 },
        { name: "Starbucks Grande Iced Black Tea Lemonade", cal: 90, pro: 0, carb: 22, fat: 0 },
        { name: "Starbucks Grande Iced Green Tea Lemonade", cal: 90, pro: 0, carb: 22, fat: 0 },
        { name: "Coca Cola (12 oz can)", cal: 140, pro: 0, carb: 39, fat: 0 },

        // Fast Food - Wendy's Breakfast
        { name: "Wendy's Breakfast Baconator", cal: 730, pro: 34, carb: 36, fat: 50 },
        { name: "Wendy's Sausage, Egg & Cheese Biscuit", cal: 600, pro: 21, carb: 35, fat: 42 },
        { name: "Wendy's Seasoned Potatoes (Small)", cal: 230, pro: 3, carb: 32, fat: 10 },
        { name: "Wendy's Seasoned Potatoes (Large)", cal: 410, pro: 6, carb: 59, fat: 17 },
        { name: "Wendy's French Toast Sticks (4 pc)", cal: 330, pro: 6, carb: 33, fat: 17 },
        { name: "Wendy's French Toast Sticks (6 pc)", cal: 490, pro: 9, carb: 50, fat: 25 },

        // Fast Food - Chipotle
        { name: "Chipotle Chicken Bowl (Standard)", cal: 650, pro: 40, carb: 65, fat: 22 },
        { name: "Chipotle Steak Burrito (Standard)", cal: 1050, pro: 45, carb: 110, fat: 43 },
        { name: "Chipotle Carnitas Tacos (3 pc)", cal: 560, pro: 32, carb: 45, fat: 26 },
        { name: "Chipotle Barbacoa Bowl (Standard)", cal: 730, pro: 35, carb: 65, fat: 35 },
        { name: "Chipotle Chicken Salad (with Vinaigrette)", cal: 460, pro: 35, carb: 23, fat: 27 },
        { name: "Chipotle Chips & Guacamole", cal: 770, pro: 10, carb: 81, fat: 41 },

        // Pasta / Italian
        { name: "Vegetable Lasagna (1 piece)", cal: 320, pro: 15, carb: 40, fat: 12 },

        // Meats
        { name: "Pot Roast (1 slice, 3 oz)", cal: 210, pro: 23, carb: 2, fat: 12 },

        // Fast Food - Arby's
        { name: "Arby's Classic Roast Beef", cal: 360, pro: 23, carb: 37, fat: 14 },
        { name: "Arby's Double Roast Beef", cal: 510, pro: 38, carb: 38, fat: 24 },
        { name: "Arby's Half Pound Roast Beef", cal: 610, pro: 48, carb: 38, fat: 30 },
        { name: "Arby's Beef 'n Cheddar Classic", cal: 450, pro: 23, carb: 45, fat: 20 },
        { name: "Arby's Crispy Chicken Sandwich", cal: 540, pro: 23, carb: 58, fat: 25 },
        { name: "Arby's Curly Fries (Medium)", cal: 550, pro: 6, carb: 65, fat: 29 },
        { name: "Arby's Mozzarella Sticks (4 ea)", cal: 440, pro: 14, carb: 37, fat: 27 },
        { name: "Arby's Jamocha Shake (Medium)", cal: 830, pro: 16, carb: 142, fat: 24 }
    ];

    // Sort foods alphabetically
    prebuiltFoods.sort((a, b) => a.name.localeCompare(b.name));

    // Populate Datalist
    const datalist = document.getElementById('food-presets');
    if (datalist) {
        prebuiltFoods.forEach(food => {
            const option = document.createElement('option');
            option.value = food.name;
            datalist.appendChild(option);
        });
    }

    // Autofill Macros when a prebuilt food or quantity is selected/changed
    const foodNameInput = document.getElementById('food-name');
    const foodQtyInput = document.getElementById('food-qty');
    
    function updateMacros() {
        const selectedFood = prebuiltFoods.find(f => f.name === foodNameInput.value);
        if (selectedFood) {
            const qty = parseFloat(foodQtyInput.value) || 1;
            document.getElementById('food-cal').value = Math.round(selectedFood.cal * qty);
            document.getElementById('food-pro').value = Math.round(selectedFood.pro * qty);
            document.getElementById('food-carb').value = Math.round(selectedFood.carb * qty);
            document.getElementById('food-fat').value = Math.round(selectedFood.fat * qty);
        }
    }

    if (foodNameInput && foodQtyInput) {
        foodNameInput.addEventListener('input', updateMacros);
        foodQtyInput.addEventListener('input', updateMacros);
    }

    // Fetch and populate dashboard data
    loadDashboard();


    document.getElementById('weight-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const weight = document.getElementById('weight-value').value;
        const id = document.getElementById('edit-weight-id').value;
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/weight/${id}` : '/api/weight';
        
        await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ memberId: member.id, weight })
        });
        
        window.cancelWeightEdit();
        loadDashboard();
    });

    document.getElementById('food-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            memberId: member.id,
            mealType: document.getElementById('food-meal').value,
            foodName: document.getElementById('food-name').value,
            calories: document.getElementById('food-cal').value,
            protein: document.getElementById('food-pro').value,
            carbs: document.getElementById('food-carb').value,
            fat: document.getElementById('food-fat').value,
        };
        
        const id = document.getElementById('edit-food-id').value;
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/food/${id}` : '/api/food';
        
        await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        cancelEdit();
        loadDashboard();
    });

    // Helper to reload everything
    async function loadDashboard() {
        try {
            const res = await fetch(`/api/dashboard/${member.id}`);
            const data = await res.json();
            
            // Populate Profile Snapshot
            if (document.getElementById('profile-name')) {
                document.getElementById('profile-name').innerText = member.name || member.email || 'Member';
            }
            
            if (data.weight_logs && data.weight_logs.length > 0 && document.getElementById('profile-current-weight')) {
                const currentWeight = data.weight_logs[0].weight;
                document.getElementById('profile-current-weight').innerText = currentWeight;

                // Calculate historical weight loss
                const getWeightDiff = (daysAgo) => {
                    const targetDate = new Date();
                    targetDate.setDate(targetDate.getDate() - daysAgo);
                    
                    let closestLog = null;
                    let smallestDiff = Infinity;
                    
                    for (const log of data.weight_logs) {
                        const logDate = new Date(log.log_date);
                        // Add timezone offset so local dates don't get shifted to previous day
                        logDate.setMinutes(logDate.getMinutes() + logDate.getTimezoneOffset());
                        
                        const diff = Math.abs(targetDate - logDate);
                        if (diff < smallestDiff && diff <= (7 * 24 * 60 * 60 * 1000)) { 
                            smallestDiff = diff;
                            closestLog = log;
                        }
                    }
                    
                    if (closestLog) {
                        const lost = closestLog.weight - currentWeight;
                        if (lost > 0) return `-${lost.toFixed(1)} lbs`;
                        if (lost < 0) return `+${Math.abs(lost).toFixed(1)} lbs`;
                        return '0.0 lbs';
                    }
                    return '--';
                };

                if (document.getElementById('stat-weight-week')) {
                    document.getElementById('stat-weight-week').innerText = getWeightDiff(7);
                    document.getElementById('stat-weight-month').innerText = getWeightDiff(30);
                }

                if (data.intake_profile && data.intake_profile.weight && document.getElementById('stat-weight-year')) {
                    const startWeight = data.intake_profile.weight;
                    const lost = startWeight - currentWeight;
                    if (lost > 0) {
                        document.getElementById('stat-weight-year').innerText = `-${lost.toFixed(1)} lbs`;
                    } else if (lost < 0) {
                        document.getElementById('stat-weight-year').innerText = `+${Math.abs(lost).toFixed(1)} lbs`;
                    } else {
                        document.getElementById('stat-weight-year').innerText = `0.0 lbs`;
                    }
                }
            }
            
            if (data.goals && document.getElementById('profile-goal-weight')) {
                document.getElementById('profile-goal-weight').innerText = data.goals.target_value || '--';
            }

            // Populate Macro Totals
            if (data.weekly_macros && document.getElementById('stat-week-cal')) {
                document.getElementById('stat-week-cal').innerText = data.weekly_macros.cal || 0;
                document.getElementById('stat-week-pro').innerText = (data.weekly_macros.pro || 0) + 'g';
                document.getElementById('stat-week-carb').innerText = (data.weekly_macros.carb || 0) + 'g';
                document.getElementById('stat-week-fat').innerText = (data.weekly_macros.fat || 0) + 'g';
            }

            if (data.yearly_macros && document.getElementById('stat-year-cal')) {
                document.getElementById('stat-year-cal').innerText = data.yearly_macros.cal || 0;
                document.getElementById('stat-year-pro').innerText = (data.yearly_macros.pro || 0) + 'g';
                document.getElementById('stat-year-carb').innerText = (data.yearly_macros.carb || 0) + 'g';
                document.getElementById('stat-year-fat').innerText = (data.yearly_macros.fat || 0) + 'g';
            }

            // Populate Weight History and Chart
            const weightTbody = document.getElementById('weight-history');
            const weightChartContainer = document.getElementById('weight-chart-container');
            weightTbody.innerHTML = '';
            
            if (data.weight_logs && data.weight_logs.length > 0) {
                window.currentWeightLogs = data.weight_logs;
                weightChartContainer.style.display = 'block';
                
                // Populate Table (newest first)
                data.weight_logs.forEach(log => {
                    weightTbody.innerHTML += `<tr>
                        <td>${log.log_date}</td>
                        <td>${log.weight}</td>
                        <td style="text-align: right;">
                            <button onclick="editWeight(${log.id})" style="background: none; border: none; color: #36a2eb; cursor: pointer; font-size: 1.1rem; margin-right: 15px;" title="Edit weight">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button onclick="deleteWeight(${log.id})" style="background: none; border: none; color: #ff6b6b; cursor: pointer; font-size: 1.1rem;" title="Delete weight">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </td>
                    </tr>`;
                });

                // Prepare data for Chart (oldest first for chronological x-axis)
                const chartLogs = [...data.weight_logs].reverse();
                const labels = chartLogs.map(log => log.log_date.substring(5)); // Just MM-DD
                const weights = chartLogs.map(log => log.weight);

                const wCtx = document.getElementById('weightChart').getContext('2d');
                if (weightChartInstance) weightChartInstance.destroy();

                weightChartInstance = new Chart(wCtx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Weight (lbs)',
                            data: weights,
                            borderColor: '#36a2eb',
                            backgroundColor: 'rgba(54, 162, 235, 0.2)',
                            borderWidth: 2,
                            pointBackgroundColor: '#fff',
                            pointBorderColor: '#36a2eb',
                            pointRadius: 4,
                            fill: true,
                            tension: 0.3
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false }
                        },
                        scales: {
                            y: {
                                suggestedMin: Math.min(...weights) - 5,
                                suggestedMax: Math.max(...weights) + 5,
                                grid: { color: 'rgba(255, 255, 255, 0.1)' },
                                ticks: { color: 'rgba(255, 255, 255, 0.7)' }
                            },
                            x: {
                                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                                ticks: { color: 'rgba(255, 255, 255, 0.7)' }
                            }
                        }
                    }
                });
            } else {
                weightChartContainer.style.display = 'none';
            }

            // Populate Food History & Calculate Macros
            const tbodies = {
                'Breakfast': document.getElementById('food-history-Breakfast'),
                'Lunch': document.getElementById('food-history-Lunch'),
                'Dinner': document.getElementById('food-history-Dinner'),
                'Snacks': document.getElementById('food-history-Snacks')
            };
            Object.values(tbodies).forEach(tb => { if(tb) tb.innerHTML = ''; });

            let tCal = 0, tPro = 0, tCarb = 0, tFat = 0;
            
            if (data.food_logs) {
                window.currentFoodLogs = data.food_logs;
                data.food_logs.forEach(log => {
                    tCal += log.calories;
                    tPro += log.protein;
                    tCarb += log.carbs;
                    tFat += log.fat;
                    
                    const mealType = log.meal_type || 'Breakfast';
                    const tb = tbodies[mealType];
                    if (tb) {
                        tb.innerHTML += `<tr>
                            <td>${log.food_name}</td>
                            <td>${log.calories}</td>
                            <td>${log.protein}g</td>
                            <td>${log.carbs}g</td>
                            <td>${log.fat}g</td>
                            <td style="text-align: right;">
                                <button onclick="editFood(${log.id})" style="background: none; border: none; color: #36a2eb; cursor: pointer; font-size: 1.1rem; margin-right: 15px;" title="Edit item">
                                    <i class="fa-solid fa-pen-to-square"></i>
                                </button>
                                <button onclick="deleteFood(${log.id})" style="background: none; border: none; color: #ff6b6b; cursor: pointer; font-size: 1.1rem;" title="Delete item">
                                    <i class="fa-solid fa-trash-can"></i>
                                </button>
                            </td>
                        </tr>`;
                    }
                });
            }
            
            document.getElementById('tot-cal').innerText = tCal;
            document.getElementById('tot-pro').innerText = tPro + 'g';
            document.getElementById('tot-carb').innerText = tCarb + 'g';
            document.getElementById('tot-fat').innerText = tFat + 'g';
            
            // Intake Profile & Chart
            if (!data.intake_profile) {
                document.getElementById('setup-banner').style.display = 'block';
                document.getElementById('macro-chart-section').style.display = 'none';
            } else {
                document.getElementById('setup-banner').style.display = 'none';
                document.getElementById('macro-chart-section').style.display = 'flex';

                const p = data.intake_profile;

                // Update Progress Texts
                document.getElementById('prog-cal-text').innerText = `${tCal} / ${p.target_cal}`;
                document.getElementById('prog-pro-text').innerText = `${tPro}g / ${p.target_pro}g`;
                document.getElementById('prog-carb-text').innerText = `${tCarb}g / ${p.target_carb}g`;
                document.getElementById('prog-fat-text').innerText = `${tFat}g / ${p.target_fat}g`;

                // Update Progress Fills
                document.getElementById('prog-cal-fill').style.width = Math.min((tCal / Math.max(p.target_cal, 1)) * 100, 100) + '%';
                document.getElementById('prog-pro-fill').style.width = Math.min((tPro / Math.max(p.target_pro, 1)) * 100, 100) + '%';
                document.getElementById('prog-carb-fill').style.width = Math.min((tCarb / Math.max(p.target_carb, 1)) * 100, 100) + '%';
                document.getElementById('prog-fat-fill').style.width = Math.min((tFat / Math.max(p.target_fat, 1)) * 100, 100) + '%';

                // Chart.js Doughnut Chart
                const ctx = document.getElementById('macroChart').getContext('2d');
                if (macroChartInstance) macroChartInstance.destroy();

                const hasMacros = (tPro + tCarb + tFat) > 0;

                macroChartInstance = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: hasMacros ? ['Protein', 'Carbs', 'Fat'] : ['No Food Logged'],
                        datasets: [{
                            data: hasMacros ? [tPro, tCarb, tFat] : [1],
                            backgroundColor: hasMacros ? ['#ff6384', '#36a2eb', '#ffce56'] : ['rgba(255,255,255,0.1)'],
                            borderWidth: 0
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'bottom', labels: { color: 'rgba(255,255,255,0.7)' } }
                        }
                    }
                });
            }

        } catch (err) {
            console.error('Failed to load dashboard', err);
        }
    }

    // Local Food Search Logic
    const localSearchBtnIcon = document.getElementById('open-local-search-btn');
    const localSearchModal = document.getElementById('local-food-search-modal');
    const closeLocalSearchBtn = document.getElementById('close-local-search-btn');
    const localSearchBtn = document.getElementById('local-search-btn');
    const localSearchInput = document.getElementById('local-search-input');
    const localSearchResults = document.getElementById('local-search-results');

    if (localSearchBtnIcon && localSearchModal) {
        localSearchBtnIcon.addEventListener('click', () => {
            localSearchModal.style.display = 'flex';
            localSearchInput.focus();
            performLocalSearch(); // Show all by default or let them type
        });

        closeLocalSearchBtn.addEventListener('click', () => {
            localSearchModal.style.display = 'none';
        });

        window.addEventListener('click', (e) => {
            if (e.target === localSearchModal) {
                localSearchModal.style.display = 'none';
            }
        });

        localSearchBtn.addEventListener('click', performLocalSearch);
        localSearchInput.addEventListener('input', performLocalSearch); // Search as they type
    }

    async function performLocalSearch() {
        const query = localSearchInput.value.toLowerCase().trim();
        localSearchResults.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 20px;">Searching...</div>';
        
        let localResults = prebuiltFoods;
        if (query) {
            localResults = prebuiltFoods.filter(food => food.name.toLowerCase().includes(query));
        }

        let dbResults = [];
        if (query && query.length >= 2) {
            try {
                const response = await fetch(`/api/food/search?q=${encodeURIComponent(query)}`);
                if (response.ok) {
                    const data = await response.json();
                    dbResults = data.map(item => ({
                        name: item.name,
                        cal: item.calories,
                        pro: item.protein,
                        carb: item.carbs,
                        fat: item.fat
                    }));
                }
            } catch (err) {
                console.error("Failed to search database", err);
            }
        }

        // Combine and remove duplicates
        const combinedResults = [...localResults, ...dbResults];
        const uniqueResults = [];
        const seenNames = new Set();
        for (const food of combinedResults) {
            if (!seenNames.has(food.name.toLowerCase())) {
                seenNames.add(food.name.toLowerCase());
                uniqueResults.push(food);
            }
        }

        if (uniqueResults.length === 0) {
            localSearchResults.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 20px;">No matching foods found in the database.</div>';
            return;
        }

        localSearchResults.innerHTML = '';

        // Limit results so DOM doesn't get overwhelmed if there are many
        const displayResults = uniqueResults.slice(0, 50);

        displayResults.forEach(food => {
            const itemDiv = document.createElement('div');
            itemDiv.style.padding = '15px';
            itemDiv.style.background = 'rgba(255,255,255,0.05)';
            itemDiv.style.borderRadius = '6px';
            itemDiv.style.cursor = 'pointer';
            itemDiv.style.border = '1px solid transparent';
            itemDiv.style.transition = 'border-color 0.2s';
            
            itemDiv.onmouseover = () => itemDiv.style.borderColor = 'var(--accent-main)';
            itemDiv.onmouseout = () => itemDiv.style.borderColor = 'transparent';

            itemDiv.innerHTML = `
                <div style="font-weight: bold; margin-bottom: 5px;">${food.name}</div>
                <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 5px;">
                    ${food.cal} Cal | ${food.pro}g Pro | ${food.carb}g Carb | ${food.fat}g Fat
                </div>
            `;

            itemDiv.addEventListener('click', () => {
                document.getElementById('food-name').value = food.name;
                document.getElementById('food-qty').value = 1;
                document.getElementById('food-cal').value = food.cal;
                document.getElementById('food-pro').value = food.pro;
                document.getElementById('food-carb').value = food.carb;
                document.getElementById('food-fat').value = food.fat;
                
                localSearchModal.style.display = 'none';
                document.getElementById('food-form').scrollIntoView({ behavior: 'smooth' });
            });

            localSearchResults.appendChild(itemDiv);
        });
    }

});
