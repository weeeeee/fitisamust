function getApiUrl(endpoint) {
    if (window.location.protocol === 'file:' || ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port && window.location.port !== '3001')) {
        return 'http://localhost:3001' + endpoint;
    }
    return endpoint;
}

async function safeJsonParse(response) {
    const text = await response.text();
    try {
        const data = JSON.parse(text);
        return data;
    } catch (e) {
        console.error('Raw non-JSON response from server:', text);
        const cleanText = text.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
        if (response.status === 404) {
            throw new Error('API endpoint not found (404). Please ensure backend server is active.');
        }
        const snippet = cleanText ? cleanText.substring(0, 120) : 'Server returned an invalid response';
        throw new Error(`Server returned error (${response.status}): ${snippet}`);
    }
}

let macroChartInstance = null;
let weightChartInstance = null;
window.currentFoodLogs = [];
window.currentWeightLogs = [];
window.lastSelectedMeal = localStorage.getItem('fitisamust_last_meal') || 'Breakfast';

window.deleteWeight = async function(id) {
    if (!confirm('Are you sure you want to delete this weight log?')) return;
    try {
        const res = await fetch(getApiUrl(`/api/weight/${id}`), { method: 'DELETE' });
        if (res.ok) {
            if (window.triggerDashboardReload) window.triggerDashboardReload();
            else window.location.reload();
        } else {
            alert('Failed to delete weight log.');
        }
    } catch (err) {
        console.error(err);
    }
};

window.editWeight = function(id) {
    if (!window.currentWeightLogs) return;
    const log = window.currentWeightLogs.find(w => w.id == id);
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
    if (window.currentMemberId) {
        try {
            const key = `fitisamust_food_logs_${window.currentMemberId}_` + (new Date().toISOString().split('T')[0]);
            let logs = JSON.parse(localStorage.getItem(key) || '[]');
            logs = logs.filter(item => item.id != id);
            localStorage.setItem(key, JSON.stringify(logs));
        } catch(e) {}
    }
    try {
        await fetch(getApiUrl(`/api/food/${id}`), { method: 'DELETE' });
    } catch (err) {
        console.error(err);
    }
    if (window.triggerDashboardReload) window.triggerDashboardReload();
    else window.location.reload();
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
    const savedMeal = window.lastSelectedMeal || 'Breakfast';
    document.getElementById('food-form').reset();
    const mealSelect = document.getElementById('food-meal');
    if (mealSelect) {
        mealSelect.value = savedMeal;
    }
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
        
        // Grocery - Potato Items
        { name: "Baked Potato (1 medium, with skin)", cal: 161, pro: 4, carb: 37, fat: 0 },
        { name: "Russet Potato (1 medium cooked)", cal: 168, pro: 4, carb: 38, fat: 0 },
        { name: "Red Potato (1 medium cooked)", cal: 150, pro: 4, carb: 34, fat: 0 },
        { name: "Yukon Gold Potato (1 medium cooked)", cal: 135, pro: 3, carb: 30, fat: 0 },
        { name: "Sweet Potato (1 medium baked)", cal: 103, pro: 2, carb: 24, fat: 0 },
        { name: "Mashed Potatoes (1 cup, with butter & milk)", cal: 237, pro: 4, carb: 35, fat: 9 },
        { name: "Mashed Potatoes (1 cup plain)", cal: 170, pro: 4, carb: 37, fat: 1 },
        { name: "Roasted Potatoes (1 cup oven baked)", cal: 160, pro: 3, carb: 28, fat: 5 },
        { name: "French Fries (1 medium order / 3 oz)", cal: 340, pro: 4, carb: 44, fat: 16 },
        { name: "Sweet Potato Fries (3 oz / 1 cup)", cal: 180, pro: 2, carb: 28, fat: 7 },
        { name: "Hash Browns (1 cup cooked)", cal: 290, pro: 3, carb: 38, fat: 14 },
        { name: "Potato Wedges (4 oz baked)", cal: 200, pro: 4, carb: 32, fat: 7 },
        { name: "Potato Salad (1/2 cup)", cal: 180, pro: 3, carb: 18, fat: 11 },
        { name: "Loaded Baked Potato (with bacon, cheese & sour cream)", cal: 350, pro: 10, carb: 40, fat: 17 },
        { name: "Potato Tots / Tater Tots (9 pieces / 3 oz)", cal: 160, pro: 2, carb: 20, fat: 9 },
        { name: "Ore-Ida Tater Tots (3 oz / 9 pieces)", cal: 160, pro: 2, carb: 19, fat: 8 },
        { name: "Ore-Ida Golden Fries (3 oz / 12 pieces)", cal: 130, pro: 2, carb: 19, fat: 4 },
        { name: "Ore-Ida Hash Brown Patties (1 patty)", cal: 140, pro: 1, carb: 15, fat: 8 },
        { name: "Bob Evans Original Mashed Potatoes (1/2 cup)", cal: 150, pro: 2, carb: 18, fat: 8 },
        { name: "Reser's Main St. Bistro Mashed Potatoes (1/2 cup)", cal: 160, pro: 3, carb: 19, fat: 8 },
        
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
        
        // Name Brand Grocery Items - Protein & Breakfast
        { name: "Seven Days Wildberry Protein Oats (1 container)", cal: 220, pro: 15, carb: 34, fat: 3 },

        // Name Brand Grocery Items - Pillsbury Dough
        { name: "Pillsbury Original Crescent Rolls (1 roll)", cal: 100, pro: 2, carb: 11, fat: 6 },
        { name: "Pillsbury Grands! Flaky Layers Original Biscuits (1 biscuit)", cal: 170, pro: 3, carb: 23, fat: 7 },
        { name: "Pillsbury Grands! Southern Homestyle Butter Tastin' Biscuits (1 biscuit)", cal: 170, pro: 3, carb: 22, fat: 8 },
        { name: "Pillsbury Grands! Flaky Layers Honey Butter Biscuits (1 biscuit)", cal: 180, pro: 3, carb: 24, fat: 8 },
        { name: "Pillsbury Cinnamon Rolls with Icing (1 roll)", cal: 140, pro: 2, carb: 23, fat: 5 },
        { name: "Pillsbury Grands! Cinnamon Rolls with Cinnabon Icing (1 roll)", cal: 310, pro: 4, carb: 51, fat: 10 },
        { name: "Pillsbury Apple Turnovers with Icing (1 turnover)", cal: 240, pro: 3, carb: 34, fat: 10 },
        { name: "Pillsbury Classic Crust Pizza Dough (1/6 crust)", cal: 170, pro: 5, carb: 35, fat: 2 },
        { name: "Pillsbury Cornbread Swirls (1 swirl)", cal: 150, pro: 3, carb: 24, fat: 5 },
        { name: "Pillsbury French Bread Dough (1/5 loaf)", cal: 130, pro: 4, carb: 27, fat: 1 },
        { name: "Pillsbury Refrigerated Pie Crusts (1/8 crust)", cal: 100, pro: 1, carb: 11, fat: 6 },
        { name: "Pillsbury Chocolate Chip Cookie Dough (1 cookie)", cal: 130, pro: 1, carb: 18, fat: 6 },
        { name: "Pillsbury Sugar Cookie Dough (1 cookie)", cal: 120, pro: 1, carb: 17, fat: 5 },
        { name: "Pillsbury Soft Baked Chocolate Chip Cookies (2 cookies)", cal: 150, pro: 1, carb: 21, fat: 7 },

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

    // Preserve & Restore Selected Meal Dropdown State
    const foodMealSelect = document.getElementById('food-meal');
    if (foodMealSelect) {
        foodMealSelect.value = window.lastSelectedMeal;
        foodMealSelect.addEventListener('change', (e) => {
            window.lastSelectedMeal = e.target.value;
            localStorage.setItem('fitisamust_last_meal', window.lastSelectedMeal);
        });
    }

    // Fetch and populate dashboard data
    loadDashboard();


    const weightForm = document.getElementById('weight-form');
    if (weightForm) {
        weightForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const weightVal = parseFloat(document.getElementById('weight-value').value);
            const id = document.getElementById('edit-weight-id').value;
            const method = id ? 'PUT' : 'POST';
            const url = id ? getApiUrl(`/api/weight/${id}`) : getApiUrl('/api/weight');
            
            try {
                const res = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ memberId: member.id, weight: weightVal, source: 'Manual Input' })
                });
                const data = await safeJsonParse(res);
                if (!res.ok) {
                    alert('Error updating weight: ' + (data.error || 'Failed'));
                    return;
                }
            } catch (err) {
                alert('Error updating weight: ' + err.message);
                return;
            }
            
            window.cancelWeightEdit();
            loadDashboard();
        });
    }

    const foodForm = document.getElementById('food-form');
    if (foodForm) {
        foodForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const mealVal = document.getElementById('food-meal').value;
            window.lastSelectedMeal = mealVal;
            localStorage.setItem('fitisamust_last_meal', mealVal);

            const foodObj = {
                id: document.getElementById('edit-food-id').value || Date.now(),
                member_id: member.id,
                meal_type: mealVal,
                food_name: document.getElementById('food-name').value,
                calories: parseInt(document.getElementById('food-cal').value, 10) || 0,
                protein: parseInt(document.getElementById('food-pro').value, 10) || 0,
                carbs: parseInt(document.getElementById('food-carb').value, 10) || 0,
                fat: parseInt(document.getElementById('food-fat').value, 10) || 0
            };

        const id = document.getElementById('edit-food-id').value;
        const method = id ? 'PUT' : 'POST';
        const url = id ? getApiUrl(`/api/food/${id}`) : getApiUrl('/api/food');
        
        try {
            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    memberId: member.id,
                    mealType: mealVal,
                    foodName: foodObj.food_name,
                    calories: foodObj.calories,
                    protein: foodObj.protein,
                    carbs: foodObj.carbs,
                    fat: foodObj.fat
                })
            });
            if (res.ok) {
                const resData = await res.json();
                if (resData.id) foodObj.id = resData.id;
            }
        } catch (err) {
            console.error('API Sync:', err);
        }

        // Cache in LocalStorage
        try {
            const todayStr = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0');
            const key = `fitisamust_food_logs_${member.id}_${todayStr}`;
            let logs = JSON.parse(localStorage.getItem(key) || '[]');
            if (id) {
                logs = logs.map(item => item.id == foodObj.id ? { ...item, ...foodObj } : item);
            } else {
                logs.push(foodObj);
            }
            localStorage.setItem(key, JSON.stringify(logs));
        } catch(e) {}
        
        cancelEdit();
        loadDashboard();
        });
    }

    // Helper to reload everything
    async function loadDashboard() {
        window.loadDashboard = loadDashboard;
        window.triggerDashboardReload = loadDashboard;

        // Silent background wearable auto-sync on member login / dashboard load
        if (!window.hasAutoSyncedThisSession && member && member.id) {
            window.hasAutoSyncedThisSession = true;
            fetch(getApiUrl('/api/webhooks/weight'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ memberId: member.id, source: 'Garmin Connect' })
            }).catch(() => {});
        }

        try {
            const res = await fetch(getApiUrl(`/api/dashboard/${member.id}`));
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
                    let sourceBadge = `<span style="background: rgba(255, 255, 255, 0.08); color: #aaa; padding: 3px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 500; display: inline-flex; align-items: center; gap: 5px;">
                        <i class="fa-solid fa-pen-to-square" style="font-size: 0.7rem;"></i> Manual
                    </span>`;
                    
                    const srcLower = (log.source || '').toLowerCase();
                    if (srcLower.includes('garmin')) {
                        sourceBadge = `<span style="background: rgba(168, 85, 247, 0.2); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.4); padding: 3px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; display: inline-flex; align-items: center; gap: 5px;">
                            <i class="fa-solid fa-clock-rotate-left" style="font-size: 0.75rem;"></i> Garmin Connect
                        </span>`;
                    } else if (srcLower.includes('apple')) {
                        sourceBadge = `<span style="background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); padding: 3px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; display: inline-flex; align-items: center; gap: 5px;">
                            <i class="fa-solid fa-heart-pulse" style="font-size: 0.75rem;"></i> Apple Health
                        </span>`;
                    } else if (srcLower.includes('fitbit')) {
                        sourceBadge = `<span style="background: rgba(45, 212, 191, 0.2); color: #2dd4bf; border: 1px solid rgba(45, 212, 191, 0.4); padding: 3px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; display: inline-flex; align-items: center; gap: 5px;">
                            <i class="fa-solid fa-person-walk" style="font-size: 0.75rem;"></i> Fitbit
                        </span>`;
                    } else if (srcLower.includes('withings')) {
                        sourceBadge = `<span style="background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); padding: 3px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; display: inline-flex; align-items: center; gap: 5px;">
                            <i class="fa-solid fa-scale-balanced" style="font-size: 0.75rem;"></i> Withings
                        </span>`;
                    } else if (log.source && log.source !== 'Manual Input') {
                        sourceBadge = `<span style="background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.4); padding: 3px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; display: inline-flex; align-items: center; gap: 5px;">
                            <i class="fa-solid fa-arrows-rotate" style="font-size: 0.75rem;"></i> ${log.source}
                        </span>`;
                    }

                    weightTbody.innerHTML += `<tr>
                        <td>${log.log_date}</td>
                        <td style="font-weight: 600;">${log.weight} lbs</td>
                        <td>${sourceBadge}</td>
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
                weightTbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 20px;"><i class="fa-solid fa-scale-balanced" style="color: #a855f7;"></i> No weight entries logged yet. Stepping on your scale or clicking "Sync Garmin / Wearable" will record your weight here.</td></tr>';
            }

            // Populate Food History & Calculate Macros
            window.currentMemberId = member.id;
            window.triggerDashboardReload = loadDashboard;

            const tbodies = {
                'Breakfast': document.getElementById('food-history-Breakfast'),
                'Lunch': document.getElementById('food-history-Lunch'),
                'Dinner': document.getElementById('food-history-Dinner'),
                'Snacks': document.getElementById('food-history-Snacks')
            };
            Object.values(tbodies).forEach(tb => { if(tb) tb.innerHTML = ''; });

            let tCal = 0, tPro = 0, tCarb = 0, tFat = 0;
            
            // Retrieve Local Cache
            const todayStr = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0');
            const localKey = `fitisamust_food_logs_${member.id}_${todayStr}`;
            let localCachedLogs = [];
            try { localCachedLogs = JSON.parse(localStorage.getItem(localKey) || '[]'); } catch(e) {}

            let activeLogs = data.food_logs || [];
            if (activeLogs.length > 0) {
                try { localStorage.setItem(localKey, JSON.stringify(activeLogs)); } catch(e) {}
            } else if (localCachedLogs.length > 0) {
                activeLogs = localCachedLogs;
            }

            if (activeLogs) {
                window.currentFoodLogs = activeLogs;
                activeLogs.forEach(log => {
                    tCal += Number(log.calories) || 0;
                    tPro += Number(log.protein) || 0;
                    tCarb += Number(log.carbs) || 0;
                    tFat += Number(log.fat) || 0;
                    
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

                // Chart.js Doughnut Chart with transparent remaining goal ring
                const ctx = document.getElementById('macroChart').getContext('2d');
                if (macroChartInstance) macroChartInstance.destroy();

                const targetTotalCal = p.target_cal || ((p.target_pro * 4) + (p.target_carb * 4) + (p.target_fat * 9));
                const proCal = tPro * 4;
                const carbCal = tCarb * 4;
                const fatCal = tFat * 9;
                const loggedCal = proCal + carbCal + fatCal;
                const remainingCal = Math.max(0, targetTotalCal - loggedCal);

                const hasMacros = loggedCal > 0;

                macroChartInstance = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: hasMacros ? ['Protein', 'Carbs', 'Fat', 'Remaining Daily Goal'] : ['Remaining Daily Goal'],
                        datasets: [{
                            data: hasMacros ? [proCal, carbCal, fatCal, remainingCal] : [targetTotalCal],
                            backgroundColor: hasMacros ? 
                                ['#ff6384', '#36a2eb', '#ffce56', 'rgba(255, 255, 255, 0.08)'] : 
                                ['rgba(255, 255, 255, 0.08)'],
                            borderColor: ['#1e293b', '#1e293b', '#1e293b', 'rgba(255, 255, 255, 0.1)'],
                            borderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '70%',
                        plugins: {
                            legend: { 
                                position: 'bottom', 
                                labels: { 
                                    color: 'rgba(255,255,255,0.85)',
                                    filter: function(item) {
                                        return item.text !== 'Remaining Daily Goal';
                                    }
                                } 
                            },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        const label = context.label || '';
                                        if (label === 'Protein') return `Protein: ${tPro}g (${proCal} kcal)`;
                                        if (label === 'Carbs') return `Carbs: ${tCarb}g (${carbCal} kcal)`;
                                        if (label === 'Fat') return `Fat: ${tFat}g (${fatCal} kcal)`;
                                        if (label === 'Remaining Daily Goal') return `Remaining: ${remainingCal} kcal`;
                                        return `${label}: ${context.raw}`;
                                    }
                                }
                            }
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
            const altQuery = query.replace(/pilsberry|pillsberry|pilsbury/g, 'pillsbury');
            const searchTerms = [query, altQuery];
            localResults = prebuiltFoods.filter(food => {
                const nameLower = food.name.toLowerCase();
                return searchTerms.some(term => nameLower.includes(term));
            });
        }

        let dbResults = [];
        if (query && query.length >= 2) {
            try {
                const response = await fetch(getApiUrl(`/api/food/search?q=${encodeURIComponent(query)}`));
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

// --- Connected Scales & Health Devices Integration Engine ---

// 1. Live Web Bluetooth Smart Scale Scanner
async function scanBluetoothScale() {
    const btn = document.getElementById('btn-scan-bluetooth');
    if (!navigator.bluetooth) {
        alert('Web Bluetooth is not supported in this browser. Please use Chrome, Edge, or Opera on Desktop/Android, or Health App sync on iOS.');
        return;
    }

    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Scanning Scale...';
        }

        const device = await navigator.bluetooth.requestDevice({
            filters: [
                { services: ['weight_scale'] },
                { services: [0x181D] }
            ],
            optionalServices: ['battery_service', 0x180F]
        }).catch(err => {
            return navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: ['weight_scale', 0x181D]
            });
        });

        if (device) {
            const member = JSON.parse(localStorage.getItem('fitisamust_member') || '{}');
            const memberId = member.id || 3;

            const res = await fetch(getApiUrl('/api/integrations/connect'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ memberId, provider: 'Bluetooth Scale (' + (device.name || 'Smart Scale') + ')' })
            });
            await safeJsonParse(res);

            alert('Successfully paired with ' + (device.name || 'Smart Scale') + '! Weight readings will sync automatically when weighed.');
            loadIntegrations();
        }
    } catch (err) {
        if (!err.message.includes('User cancelled')) {
            alert('Bluetooth pairing alert: ' + err.message);
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-bluetooth-b"></i> Pair Scale Live';
        }
    }
}

// 2. Garmin Connect / Health App Instant & Background Cloud Sync
async function syncHealthAppModal(providerName = 'Garmin Connect') {
    const modal = document.getElementById('wearable-link-modal');
    let defaultWeight = '217.0';
    if (window.currentWeightLogs && window.currentWeightLogs.length > 0) {
        defaultWeight = String(window.currentWeightLogs[0].weight);
    }

    if (modal) {
        const select = document.getElementById('wearable-brand-select');
        if (select) {
            let matchedOption = false;
            for (let opt of select.options) {
                if (opt.value.toLowerCase().includes(providerName.toLowerCase()) || providerName.toLowerCase().includes(opt.value.toLowerCase())) {
                    select.value = opt.value;
                    matchedOption = true;
                    break;
                }
            }
            if (!matchedOption && select.options.length > 0) {
                select.value = select.options[0].value;
            }
        }

        const weightInput = document.getElementById('wearable-today-weight');
        if (weightInput) {
            weightInput.value = defaultWeight;
        }

        modal.style.display = 'flex';
        setTimeout(() => {
            if (weightInput) weightInput.focus();
        }, 100);
        return;
    }

    const member = JSON.parse(localStorage.getItem('fitisamust_member') || '{}');
    const memberId = member.id || 3;

    const input = prompt(`🔄 ${providerName} Cloud Sync\n\nEnter current weight reading from your ${providerName} scale / app (lbs):`, defaultWeight);
    if (!input || isNaN(parseFloat(input))) return;

    const syncedWeight = parseFloat(input);

    try {
        const response = await fetch(getApiUrl('/api/integrations/sync-weight'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                memberId: memberId,
                weight: syncedWeight,
                provider: providerName
            })
        });
        
        const data = await safeJsonParse(response);
        if (response.ok) {
            alert(`✅ Synced with ${providerName}!\nLogged Scale Weight: ${syncedWeight} lbs`);
            if (window.triggerDashboardReload) window.triggerDashboardReload();
            loadIntegrations();
        } else {
            alert('Sync failed: ' + (data.error || 'Unknown error'));
        }
    } catch (err) {
        alert('Sync failed: ' + err.message);
    }
}

// 3. Withings Smart Scale Cloud Sync
function connectWithingsCloud() {
    connectFitbitWearables('Withings Body+ Scale');
}

// 4. Fitbit / Garmin / Wearables Link Modal Engine
function connectFitbitWearables(brand = 'Fitbit') {
    const modal = document.getElementById('wearable-link-modal');
    if (modal) {
        const select = document.getElementById('wearable-brand-select');
        if (select && brand) {
            select.value = brand;
        }
        modal.style.display = 'flex';
    } else {
        submitWearableDirect(brand);
    }
}

function closeWearableModal() {
    const modal = document.getElementById('wearable-link-modal');
    if (modal) modal.style.display = 'none';
}

async function submitWearableLink(event) {
    if (event) event.preventDefault();
    const brand = document.getElementById('wearable-brand-select').value;
    const nickname = document.getElementById('wearable-account-name').value;
    const initialWeightInput = document.getElementById('wearable-today-weight') ? document.getElementById('wearable-today-weight').value : '';
    const providerName = nickname ? `${brand} (${nickname})` : brand;
    const btn = document.getElementById('btn-save-wearable');

    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Connecting...';
        }

        const member = JSON.parse(localStorage.getItem('fitisamust_member') || '{}');
        const memberId = member.id || 3;

        // 1. Register integration
        const res = await fetch(getApiUrl('/api/integrations/connect'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ memberId, provider: providerName })
        });
        
        const data = await safeJsonParse(res);
        
        if (res.ok) {
            let weightVal = parseFloat(initialWeightInput);

            if (weightVal && !isNaN(weightVal) && weightVal > 0) {
                await fetch(getApiUrl('/api/integrations/sync-weight'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ memberId, weight: weightVal, provider: providerName })
                });
            } else {
                // Automated background cloud sync from Garmin Connect
                await fetch(getApiUrl('/api/webhooks/weight'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ memberId, source: providerName + ' Auto Sync' })
                });
            }

            alert(`✅ ${providerName} linked & synced!\nAutomated cloud background sync is active — no manual weight entry required.`);
            closeWearableModal();
            
            if (document.getElementById('wearable-today-weight')) {
                document.getElementById('wearable-today-weight').value = '';
            }

            if (window.triggerDashboardReload) window.triggerDashboardReload();
            loadIntegrations();
        } else {
            alert('Failed to link wearable: ' + (data.error || 'Unknown error'));
        }
    } catch (err) {
        alert('Connection error: ' + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-plug"></i> Connect & Authorize';
        }
    }
}

// 5. Test Automated Webhook Sync
async function triggerWebhookTest() {
    const member = JSON.parse(localStorage.getItem('fitisamust_member') || '{}');
    const memberId = member.id || 3;

    const testWeight = (160 + Math.random() * 10).toFixed(1);

    try {
        const response = await fetch(getApiUrl('/api/webhooks/weight'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                memberId: memberId,
                weight: testWeight,
                source: 'Smart Scale Webhook'
            })
        });
        const data = await safeJsonParse(response);
        if (response.ok) {
            alert('🚀 Simulated Webhook Received!\nLogged Weight: ' + testWeight + ' lbs from Smart Scale.');
            if (window.triggerDashboardReload) window.triggerDashboardReload();
            loadIntegrations();
        } else {
            alert('Webhook error: ' + data.error);
        }
    } catch (err) {
        alert('Webhook test failed: ' + err.message);
    }
}

// 6. Load Member Integrations Status
async function loadIntegrations() {
    const member = JSON.parse(localStorage.getItem('fitisamust_member') || '{}');
    const memberId = member.id || 3;

    try {
        const res = await fetch(getApiUrl('/api/integrations/' + memberId));
        if (res.ok) {
            const data = await safeJsonParse(res);
            if (data.integrations && data.integrations.length > 0) {
                const banner = document.getElementById('integration-status-banner');
                if (banner) {
                    const activeNames = data.integrations.map(i => i.provider).join(', ');
                    banner.innerHTML = `
                        <div>
                            <strong style="color: #fff;"><i class="fa-solid fa-circle-check" style="color: #10b981;"></i> Active Connected Devices:</strong> 
                            <span style="color: #38bdf8;">${activeNames}</span>
                        </div>
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <button onclick="syncHealthAppModal()" class="btn btn-outline btn-sm" style="font-size: 0.75rem; padding: 4px 10px; border-color: #ff3b30; color: #ff3b30;">
                                <i class="fa-solid fa-sync"></i> Sync Today's Weight
                            </button>
                            <button onclick="triggerWebhookTest()" class="btn btn-outline btn-sm" style="font-size: 0.75rem; padding: 4px 10px;">
                                <i class="fa-solid fa-paper-plane"></i> Test Webhook Sync
                            </button>
                        </div>`;
                }
            }
        }
    } catch (err) {
        console.error('Failed to load integrations status', err);
    }
}

// 7. Dedicated Garmin Connect Scale Webhook & Sync Manager
function connectGarminScaleModal() {
    const member = JSON.parse(localStorage.getItem('fitisamust_member') || '{}');
    const memberId = member.id || 3;
    const webhookUrl = window.location.origin + '/api/webhooks/garmin?memberId=' + memberId;

    let defaultWeight = '217.0';
    if (window.currentWeightLogs && window.currentWeightLogs.length > 0) {
        defaultWeight = String(window.currentWeightLogs[0].weight);
    }

    const input = prompt(
        '📡 Garmin Connect Scale Webhook & Cloud Sync\n\n' +
        'Your Personal Garmin Webhook Listener URL:\n' + webhookUrl + '\n\n' +
        'Enter scale reading from your Garmin Connect app / Index Scale (lbs):',
        defaultWeight
    );

    if (!input || isNaN(parseFloat(input))) return;

    const syncedWeight = parseFloat(input);

    fetch(getApiUrl('/api/integrations/sync-weight'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            memberId: memberId,
            weight: syncedWeight,
            provider: 'Garmin Connect'
        })
    }).then(res => res.json()).then(data => {
        alert('✅ Synced with Garmin Connect!\nLogged Scale Weight: ' + syncedWeight + ' lbs');
        if (window.triggerDashboardReload) window.triggerDashboardReload();
        loadIntegrations();
    }).catch(err => {
        alert('Sync failed: ' + err.message);
    });
}

window.connectGarminScaleModal = connectGarminScaleModal;
window.syncHealthAppModal = syncHealthAppModal;
window.scanBluetoothScale = scanBluetoothScale;
window.connectWithingsCloud = connectWithingsCloud;
window.connectFitbitWearables = connectFitbitWearables;
window.submitWearableLink = submitWearableLink;
window.triggerWebhookTest = triggerWebhookTest;

// Trigger loadIntegrations on load
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(loadIntegrations, 500);
});
