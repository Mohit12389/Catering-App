/**
 * Prisma Seed Script — Anchal Caterers v2
 * Seeds: IngredientCategory, Ingredient, and ItemIngredient (recipes)
 * 
 * PRE-REQUISITE: Run seed-menu.ts FIRST
 * Usage: npx tsx prisma/seed-ingredients.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const USER_ID = "cmk4zhw7i000010yljfqnljed";

interface IngredientSeed {
  name: string;
  unit: string;
  ratePerUnit: number;
}

interface IngCategorySeed {
  name: string;
  ingredients: IngredientSeed[];
}

const ingredientData: IngCategorySeed[] = [
  // ═══════════════════════════════════════════════════════════════════════
  // 01-Ration (ALL 186 items)
  // ═══════════════════════════════════════════════════════════════════════
  {
    name: "01-Ration",
    ingredients: [
      { name: "Aatta", unit: "Kg", ratePerUnit: 34 },
      { name: "Maida", unit: "Kg", ratePerUnit: 36 },
      { name: "Besan Barik", unit: "Kg", ratePerUnit: 102 },
      { name: "Besan Mota", unit: "Kg", ratePerUnit: 88 },
      { name: "Mandwe Ka Atta", unit: "Kg", ratePerUnit: 0 },
      { name: "Kuttu Ka Atta", unit: "Kg", ratePerUnit: 0 },
      { name: "Chawal Basmati", unit: "Kg", ratePerUnit: 111 },
      { name: "Chawal Mote", unit: "Kg", ratePerUnit: 31 },
      { name: "Chawal Parmal", unit: "Kg", ratePerUnit: 38 },
      { name: "Chawal Khanda", unit: "Kg", ratePerUnit: 34 },
      { name: "Jhangora", unit: "Kg", ratePerUnit: 0 },
      { name: "Kulad", unit: "Kg", ratePerUnit: 0 },
      { name: "Tor", unit: "Kg", ratePerUnit: 0 },
      { name: "Chana Kabuli", unit: "Kg", ratePerUnit: 162 },
      { name: "Soyabean Dal", unit: "Kg", ratePerUnit: 0 },
      { name: "Rajma", unit: "Kg", ratePerUnit: 130 },
      { name: "Urad Saboot", unit: "Kg", ratePerUnit: 124 },
      { name: "Masoor", unit: "Kg", ratePerUnit: 0 },
      { name: "Lobiya", unit: "Kg", ratePerUnit: 0 },
      { name: "Urad Dhuli", unit: "Kg", ratePerUnit: 145 },
      { name: "Mung Dhuli", unit: "Kg", ratePerUnit: 125 },
      { name: "Chana Dal", unit: "Kg", ratePerUnit: 85 },
      { name: "Arhar", unit: "Kg", ratePerUnit: 120 },
      { name: "Malka", unit: "Kg", ratePerUnit: 82 },
      { name: "Refined Tin", unit: "Tin", ratePerUnit: 2270 },
      { name: "Bura", unit: "Kg", ratePerUnit: 0 },
      { name: "Shakkar", unit: "Kg", ratePerUnit: 54 },
      { name: "Chini", unit: "Kg", ratePerUnit: 45 },
      { name: "Ghee Dalda", unit: "Kg", ratePerUnit: 150 },
      { name: "Suji", unit: "Kg", ratePerUnit: 37 },
      { name: "Kaju Tukda", unit: "Kg", ratePerUnit: 850 },
      { name: "Magaj Mota", unit: "Kg", ratePerUnit: 665 },
      { name: "Magaj Barik", unit: "Kg", ratePerUnit: 0 },
      { name: "Kismis", unit: "Kg", ratePerUnit: 500 },
      { name: "Chuhare", unit: "Kg", ratePerUnit: 340 },
      { name: "Badam Giri", unit: "Kg", ratePerUnit: 600 },
      { name: "Pista", unit: "Kg", ratePerUnit: 0 },
      { name: "Akhrot Giri", unit: "Kg", ratePerUnit: 0 },
      { name: "Chironji", unit: "Kg", ratePerUnit: 1800 },
      { name: "Kaju Saboot", unit: "Kg", ratePerUnit: 0 },
      { name: "Macaroni", unit: "Kg", ratePerUnit: 50 },
      { name: "Soya Bin Chura", unit: "Kg", ratePerUnit: 90 },
      { name: "Til Safed", unit: "Kg", ratePerUnit: 180 },
      { name: "Til Kale", unit: "Kg", ratePerUnit: 150 },
      { name: "Sabudana", unit: "Kg", ratePerUnit: 0 },
      { name: "Anar Dana", unit: "Kg", ratePerUnit: 380 },
      { name: "Makhana", unit: "Kg", ratePerUnit: 1320 },
      { name: "Moongfali", unit: "Kg", ratePerUnit: 140 },
      { name: "Bhangjeer", unit: "Kg", ratePerUnit: 0 },
      { name: "Poha", unit: "Kg", ratePerUnit: 0 },
      { name: "Makki Ka Atta", unit: "Kg", ratePerUnit: 0 },
      { name: "Basanti Atta", unit: "Kg", ratePerUnit: 0 },
      { name: "Amchur Saboot", unit: "Kg", ratePerUnit: 340 },
      { name: "Imli", unit: "Kg", ratePerUnit: 60 },
      { name: "Ajwain", unit: "Kg", ratePerUnit: 240 },
      { name: "Arrowroot", unit: "Kg", ratePerUnit: 46 },
      { name: "Chai Patti", unit: "Kg", ratePerUnit: 412 },
      { name: "Coffee Powder", unit: "Kg", ratePerUnit: 2900 },
      { name: "Sonth Pisi", unit: "Kg", ratePerUnit: 0 },
      { name: "Chocolate Powder", unit: "Dibbi", ratePerUnit: 50 },
      { name: "Saunf Pisi", unit: "Kg", ratePerUnit: 300 },
      { name: "Amchur Pisa", unit: "Kg", ratePerUnit: 350 },
      { name: "Namak", unit: "Kg", ratePerUnit: 25 },
      { name: "Kala Namak Pisa", unit: "Kg", ratePerUnit: 32 },
      { name: "Sendha Namak", unit: "Kg", ratePerUnit: 0 },
      { name: "Ajinomoto", unit: "Kg", ratePerUnit: 200 },
      { name: "Kali Mirch Pisi", unit: "Kg", ratePerUnit: 740 },
      { name: "White Pepper", unit: "Kg", ratePerUnit: 1450 },
      { name: "Garam Masala Pisa", unit: "Kg", ratePerUnit: 0 },
      { name: "Jeera Pisa", unit: "Kg", ratePerUnit: 280 },
      { name: "Dhaniya Pisa", unit: "Kg", ratePerUnit: 120 },
      { name: "Mirch Pisi", unit: "Kg", ratePerUnit: 280 },
      { name: "Haldi Pisi", unit: "Kg", ratePerUnit: 200 },
      { name: "Mirch Saboot", unit: "Kg", ratePerUnit: 250 },
      { name: "Dhaniya Saboot", unit: "Kg", ratePerUnit: 140 },
      { name: "Methi Saboot", unit: "Kg", ratePerUnit: 240 },
      { name: "Jakhya", unit: "Kg", ratePerUnit: 0 },
      { name: "Jeera Saboot", unit: "Kg", ratePerUnit: 300 },
      { name: "Kali Mirch Saboot", unit: "Kg", ratePerUnit: 740 },
      { name: "Khara Masala", unit: "Kg", ratePerUnit: 900 },
      { name: "Choti Elaichi Saboot", unit: "Kg", ratePerUnit: 2800 },
      { name: "Moti Elaichi Saboot", unit: "Kg", ratePerUnit: 1800 },
      { name: "Dalchini", unit: "Kg", ratePerUnit: 0 },
      { name: "Laung", unit: "Kg", ratePerUnit: 0 },
      { name: "Javitri", unit: "Kg", ratePerUnit: 0 },
      { name: "Jaiphal", unit: "Nos", ratePerUnit: 0 },
      { name: "Hing", unit: "Kg", ratePerUnit: 3600 },
      { name: "Sarso", unit: "Kg", ratePerUnit: 150 },
      { name: "Rai", unit: "Kg", ratePerUnit: 240 },
      { name: "Tatri", unit: "Kg", ratePerUnit: 0 },
      { name: "Kasuri Methi", unit: "Kg", ratePerUnit: 300 },
      { name: "Chat Masala", unit: "Pkt", ratePerUnit: 92 },
      { name: "Meat Masala", unit: "Pkt", ratePerUnit: 98 },
      { name: "Kitchen King", unit: "Pkt", ratePerUnit: 98 },
      { name: "Rangeen Mirch", unit: "Pkt", ratePerUnit: 110 },
      { name: "Chana Masala", unit: "Pkt", ratePerUnit: 92 },
      { name: "Sambhar Masala", unit: "Pkt", ratePerUnit: 85 },
      { name: "Pav Bhaji Masala", unit: "Pkt", ratePerUnit: 76 },
      { name: "Jaljira", unit: "Kg", ratePerUnit: 270 },
      { name: "Sirka", unit: "Bot", ratePerUnit: 70 },
      { name: "Tomato Sauce", unit: "Bot", ratePerUnit: 85 },
      { name: "Chilli Sauce", unit: "Bot", ratePerUnit: 80 },
      { name: "Soya Sauce", unit: "Bot", ratePerUnit: 82 },
      { name: "Khane Ka Soda", unit: "Kg", ratePerUnit: 60 },
      { name: "Achar", unit: "Kg", ratePerUnit: 50 },
      { name: "Shahad", unit: "Kg", ratePerUnit: 450 },
      { name: "Papad Chota", unit: "Pkt", ratePerUnit: 48 },
      { name: "Baking Powder", unit: "Dibbi", ratePerUnit: 16 },
      { name: "Jelly", unit: "Pkt", ratePerUnit: 0 },
      { name: "Fruit Cocktail", unit: "Dibba", ratePerUnit: 75 },
      { name: "Cherry", unit: "Dibba", ratePerUnit: 150 },
      { name: "Oregano", unit: "Dibbi", ratePerUnit: 150 },
      { name: "Penne Pasta", unit: "Kg", ratePerUnit: 150 },
      { name: "Fusilli Pasta", unit: "Kg", ratePerUnit: 150 },
      { name: "Basil", unit: "Dibbi", ratePerUnit: 150 },
      { name: "Green Olive", unit: "Bot", ratePerUnit: 460 },
      { name: "Black Olive", unit: "Bot", ratePerUnit: 460 },
      { name: "Baby Corn Dibba", unit: "Dibba", ratePerUnit: 50 },
      { name: "Rosemary", unit: "Dibbi", ratePerUnit: 150 },
      { name: "Condensed Milk", unit: "Dibba", ratePerUnit: 100 },
      { name: "Salad Oil", unit: "Ltr", ratePerUnit: 120 },
      { name: "Sweet Chilli Sauce", unit: "Bot", ratePerUnit: 300 },
      { name: "Mixed Herbs", unit: "Dibbi", ratePerUnit: 150 },
      { name: "Red Chilli Flakes", unit: "Dibbi", ratePerUnit: 100 },
      { name: "Sarson Ka Tel", unit: "Ltr", ratePerUnit: 140 },
      { name: "Tomato Puree", unit: "Kg", ratePerUnit: 150 },
      { name: "Olive Oil", unit: "Ltr", ratePerUnit: 750 },
      { name: "Thai Red Paste", unit: "Kg", ratePerUnit: 150 },
      { name: "Mustard Paste", unit: "Kg", ratePerUnit: 200 },
      { name: "Nirma", unit: "Kg", ratePerUnit: 64 },
      { name: "Tokri", unit: "Nos", ratePerUnit: 50 },
      { name: "Lakdi Chammach", unit: "Nos", ratePerUnit: 1 },
      { name: "Icecream Cup", unit: "Nos", ratePerUnit: 0.6 },
      { name: "Chat Plate", unit: "Nos", ratePerUnit: 0.65 },
      { name: "Dona", unit: "Nos", ratePerUnit: 0.6 },
      { name: "Kante Plate", unit: "Nos", ratePerUnit: 1.5 },
      { name: "Dosa Plate", unit: "Nos", ratePerUnit: 0.65 },
      { name: "Lakdi Chammach VIP", unit: "Nos", ratePerUnit: 0.5 },
      { name: "Silver Varak", unit: "Kg", ratePerUnit: 450 },
      { name: "Paper Glass 200ml", unit: "Pkt", ratePerUnit: 65 },
      { name: "Paper Glass 150ml", unit: "Pkt", ratePerUnit: 35 },
      { name: "Dona 6 No", unit: "Pkt", ratePerUnit: 0.65 },
      { name: "Toothpick", unit: "Dibbi", ratePerUnit: 12 },
      { name: "Paper Napkin", unit: "Pkt", ratePerUnit: 25 },
      { name: "Satay Stick", unit: "Pkt", ratePerUnit: 0 },
      { name: "Clean Sheet", unit: "Nos", ratePerUnit: 120 },
      { name: "Fruit Kante", unit: "Nos", ratePerUnit: 0.5 },
      { name: "Garbage Bag", unit: "Nos", ratePerUnit: 10 },
      { name: "Kulhad", unit: "Nos", ratePerUnit: 0 },
      { name: "Lunch Box", unit: "Nos", ratePerUnit: 0 },
      { name: "Pattal", unit: "Nos", ratePerUnit: 1 },
      { name: "Dal", unit: "Kg", ratePerUnit: 0 },
      { name: "Atta Chana", unit: "Kg", ratePerUnit: 0 },
      { name: "Lal Rang", unit: "Dibbi", ratePerUnit: 15 },
      { name: "Hara Rang", unit: "Dibbi", ratePerUnit: 15 },
      { name: "Peela Rang", unit: "Dibbi", ratePerUnit: 15 },
      { name: "Chawal Saifee Blue", unit: "Kg", ratePerUnit: 55 },
      { name: "Chawal Makhan Chor", unit: "Kg", ratePerUnit: 74 },
      { name: "Kale Chane", unit: "Kg", ratePerUnit: 80 },
      { name: "Moong Saboot", unit: "Kg", ratePerUnit: 112 },
      { name: "Tomato Sauce Can", unit: "Can", ratePerUnit: 300 },
      { name: "Chilli Sauce Can", unit: "Can", ratePerUnit: 280 },
      { name: "Mayonnaise", unit: "Kg", ratePerUnit: 120 },
      { name: "Gud", unit: "Kg", ratePerUnit: 60 },
      { name: "Panko Crumbs", unit: "Kg", ratePerUnit: 130 },
      { name: "Refined Oil Kg", unit: "Kg", ratePerUnit: 152 },
      { name: "Cylinder", unit: "Nos", ratePerUnit: 1805 },
      { name: "Purane Kapde", unit: "Nos", ratePerUnit: 30 },
      { name: "Markin", unit: "Mtr", ratePerUnit: 30 },
      { name: "Eno", unit: "Box", ratePerUnit: 50 },
      { name: "Laal Chawal", unit: "Kg", ratePerUnit: 200 },
      { name: "Kesar", unit: "Dibbi", ratePerUnit: 300 },
      { name: "Elaichi Pisi", unit: "Kg", ratePerUnit: 1200 },
      { name: "Bhoone Chane", unit: "Kg", ratePerUnit: 200 },
      { name: "Nariyal Burada", unit: "Kg", ratePerUnit: 200 },
      { name: "Pineapple Slice", unit: "Tin", ratePerUnit: 200 },
      { name: "Gulab Ki Pattiyan", unit: "Kg", ratePerUnit: 500 },
      { name: "Green Tea", unit: "Kg", ratePerUnit: 500 },
      { name: "Mulethi", unit: "Kg", ratePerUnit: 300 },
      { name: "Banshaka", unit: "Kg", ratePerUnit: 500 },
      { name: "Saunf Saboot", unit: "Ltr", ratePerUnit: 150 },
      { name: "Safed Moongfali", unit: "Kg", ratePerUnit: 200 },
      { name: "Sweet Corn Dibba", unit: "Nos", ratePerUnit: 40 },
      { name: "Ammonia Soda", unit: "Kg", ratePerUnit: 200 },
      { name: "Canopy", unit: "Pkt", ratePerUnit: 400 },
      { name: "Snacks Plate", unit: "Nos", ratePerUnit: 5 },
      { name: "Maggi", unit: "Nos", ratePerUnit: 60 },
      { name: "Sewai", unit: "Kg", ratePerUnit: 200 },
      { name: "Matar Saboot", unit: "Kg", ratePerUnit: 150 },
      { name: "Aande", unit: "Pcs", ratePerUnit: 6 },
    ],
  },
  // ═══════════════════════════════════════════════════════════════════════
  // 02-Dairy (ALL 63 items)
  // ═══════════════════════════════════════════════════════════════════════
  {
    name: "02-Dairy",
    ingredients: [
      { name: "Barik Sev", unit: "Kg", ratePerUnit: 200 },
      { name: "Dal Moth", unit: "Kg", ratePerUnit: 200 },
      { name: "Murmure", unit: "Kg", ratePerUnit: 50 },
      { name: "Noodles Gili", unit: "Kg", ratePerUnit: 40 },
      { name: "Cold Drink", unit: "Bot", ratePerUnit: 90 },
      { name: "Amul Cheese", unit: "Kg", ratePerUnit: 450 },
      { name: "Mozzarella Cheese", unit: "Kg", ratePerUnit: 450 },
      { name: "Cream", unit: "Kg", ratePerUnit: 250 },
      { name: "Makkhan", unit: "Kg", ratePerUnit: 550 },
      { name: "Dahi", unit: "Kg", ratePerUnit: 100 },
      { name: "Doodh", unit: "Ltr", ratePerUnit: 66 },
      { name: "Paneer", unit: "Kg", ratePerUnit: 400 },
      { name: "Mawa", unit: "Kg", ratePerUnit: 300 },
      { name: "Desi Ghee", unit: "Kg", ratePerUnit: 560 },
      { name: "Gulab Jamun", unit: "Nos", ratePerUnit: 15 },
      { name: "Rasmalai", unit: "Nos", ratePerUnit: 30 },
      { name: "Imarti", unit: "Pcs", ratePerUnit: 5 },
      { name: "Rabdi", unit: "Kg", ratePerUnit: 250 },
      { name: "Gulab Jamun Dry", unit: "Nos", ratePerUnit: 15 },
      { name: "Bhaji 1kg", unit: "Box", ratePerUnit: 240 },
      { name: "Bhaji 2kg", unit: "Box", ratePerUnit: 480 },
      { name: "Bhaji Half Kg", unit: "Box", ratePerUnit: 220 },
      { name: "Laddu 4pcs", unit: "Pkt", ratePerUnit: 46 },
      { name: "Chena Murki", unit: "Kg", ratePerUnit: 480 },
      { name: "Rotana", unit: "Kg", ratePerUnit: 240 },
      { name: "Moong Burfi", unit: "Kg", ratePerUnit: 480 },
      { name: "Rushbhari", unit: "Kg", ratePerUnit: 400 },
      { name: "Barfi", unit: "Kg", ratePerUnit: 440 },
      { name: "Arse", unit: "Kg", ratePerUnit: 220 },
      { name: "Gud Pare", unit: "Kg", ratePerUnit: 240 },
      { name: "Kaju Katli", unit: "Kg", ratePerUnit: 900 },
      { name: "Mathi", unit: "Kg", ratePerUnit: 240 },
      { name: "Balushahi", unit: "Kg", ratePerUnit: 240 },
      { name: "Shakkar Pare", unit: "Kg", ratePerUnit: 240 },
      { name: "Besan Laddu", unit: "Kg", ratePerUnit: 240 },
      { name: "Moong Halwa", unit: "Kg", ratePerUnit: 460 },
      { name: "Peda", unit: "Kg", ratePerUnit: 480 },
      { name: "Guldana", unit: "Kg", ratePerUnit: 200 },
      { name: "Mattha", unit: "Kg", ratePerUnit: 40 },
      { name: "Gajar Halwa", unit: "Kg", ratePerUnit: 400 },
      { name: "Samosa", unit: "Nos", ratePerUnit: 15 },
      { name: "Mini Samosa", unit: "Kg", ratePerUnit: 300 },
      { name: "Boondi Laddu", unit: "Kg", ratePerUnit: 240 },
      { name: "Pista Biscuit", unit: "Nos", ratePerUnit: 2 },
      { name: "Biscuit", unit: "Nos", ratePerUnit: 2 },
      { name: "Moongfali Namkeen", unit: "Kg", ratePerUnit: 200 },
      { name: "Kachori", unit: "Kg", ratePerUnit: 300 },
      { name: "Khameer", unit: "Kg", ratePerUnit: 40 },
      { name: "Raita Boondi", unit: "Kg", ratePerUnit: 200 },
      { name: "Namak Pare", unit: "Kg", ratePerUnit: 240 },
      { name: "Rasgulla", unit: "Nos", ratePerUnit: 25 },
      { name: "Safed Makhan", unit: "Kg", ratePerUnit: 500 },
      { name: "Chena Kheer", unit: "Kg", ratePerUnit: 300 },
      { name: "Dhokla", unit: "Kg", ratePerUnit: 300 },
      { name: "Real Juice", unit: "Nos", ratePerUnit: 120 },
      { name: "Chaanch", unit: "Pkt", ratePerUnit: 20 },
      { name: "Nimboo Bottle", unit: "Bottle", ratePerUnit: 20 },
      { name: "Jaljeera Bottle", unit: "Bottle", ratePerUnit: 20 },
      { name: "Malpua", unit: "Kg", ratePerUnit: 480 },
      { name: "Chena Toast", unit: "Nos", ratePerUnit: 40 },
      { name: "Kalakand", unit: "Kg", ratePerUnit: 500 },
      { name: "Mix Sweets", unit: "Kg", ratePerUnit: 380 },
      { name: "Buransh Juice", unit: "Ltr", ratePerUnit: 100 },
      { name: "Pav", unit: "Nos", ratePerUnit: 3 },
    ],
  },
  // ═══════════════════════════════════════════════════════════════════════
  // 03-Vegetables (ALL 70 items)
  // ═══════════════════════════════════════════════════════════════════════
  {
    name: "03-Vegetables",
    ingredients: [
      { name: "Lahsun", unit: "Kg", ratePerUnit: 120 },
      { name: "Pyaj", unit: "Kg", ratePerUnit: 25 },
      { name: "Aaloo", unit: "Kg", ratePerUnit: 22 },
      { name: "Tamatar", unit: "Kg", ratePerUnit: 35 },
      { name: "Gajar", unit: "Kg", ratePerUnit: 40 },
      { name: "Phrasbean", unit: "Kg", ratePerUnit: 140 },
      { name: "Patta Gobhi", unit: "Kg", ratePerUnit: 40 },
      { name: "Phool Gobhi", unit: "Kg", ratePerUnit: 80 },
      { name: "Baingan Chota", unit: "Kg", ratePerUnit: 40 },
      { name: "Kaddu", unit: "Kg", ratePerUnit: 35 },
      { name: "Baingan Bada", unit: "Kg", ratePerUnit: 40 },
      { name: "Karela Chota", unit: "Kg", ratePerUnit: 80 },
      { name: "Arbi", unit: "Kg", ratePerUnit: 120 },
      { name: "Bhindi", unit: "Kg", ratePerUnit: 90 },
      { name: "Raai", unit: "Kg", ratePerUnit: 30 },
      { name: "Palak", unit: "Kg", ratePerUnit: 80 },
      { name: "Lauki", unit: "Kg", ratePerUnit: 40 },
      { name: "Shimla Mirch", unit: "Kg", ratePerUnit: 120 },
      { name: "Sarson Saag", unit: "Kg", ratePerUnit: 60 },
      { name: "Bathua", unit: "Kg", ratePerUnit: 60 },
      { name: "Saag Chana", unit: "Kg", ratePerUnit: 80 },
      { name: "Bichu Ghas", unit: "Kg", ratePerUnit: 60 },
      { name: "Suswa", unit: "Kg", ratePerUnit: 60 },
      { name: "Galgal", unit: "Nos", ratePerUnit: 50 },
      { name: "Hara Pyaj", unit: "Kg", ratePerUnit: 80 },
      { name: "Chukandar", unit: "Kg", ratePerUnit: 60 },
      { name: "Kheera Desi", unit: "Kg", ratePerUnit: 40 },
      { name: "Mooli", unit: "Kg", ratePerUnit: 40 },
      { name: "Hara Dhaniya", unit: "Kg", ratePerUnit: 50 },
      { name: "Hari Mirch", unit: "Kg", ratePerUnit: 90 },
      { name: "Salan Mirch", unit: "Kg", ratePerUnit: 0 },
      { name: "Pudina", unit: "Bunch", ratePerUnit: 35 },
      { name: "Adrak", unit: "Kg", ratePerUnit: 100 },
      { name: "Nimbu", unit: "Kg", ratePerUnit: 120 },
      { name: "Kacha Nariyal", unit: "Kg", ratePerUnit: 35 },
      { name: "American Corn", unit: "Kg", ratePerUnit: 110 },
      { name: "Mushroom", unit: "Kg", ratePerUnit: 130 },
      { name: "Matar Safal", unit: "Kg", ratePerUnit: 480 },
      { name: "Soya Chaap", unit: "Kg", ratePerUnit: 150 },
      { name: "Curry Patta", unit: "Bunch", ratePerUnit: 0 },
      { name: "Kamal Kakdi", unit: "Kg", ratePerUnit: 0 },
      { name: "Kacha Kela", unit: "Kg", ratePerUnit: 0 },
      { name: "Parmal", unit: "Kg", ratePerUnit: 0 },
      { name: "Salad Patta", unit: "Kg", ratePerUnit: 140 },
      { name: "Lal Shimla Mirch", unit: "Kg", ratePerUnit: 150 },
      { name: "Broccoli", unit: "Kg", ratePerUnit: 0 },
      { name: "Peeli Jugani", unit: "Kg", ratePerUnit: 0 },
      { name: "Hari Jugni", unit: "Kg", ratePerUnit: 0 },
      { name: "Hari Mausammi", unit: "Kg", ratePerUnit: 0 },
      { name: "Pili Shimla Mirch", unit: "Kg", ratePerUnit: 0 },
      { name: "Apple", unit: "Kg", ratePerUnit: 160 },
      { name: "Kela", unit: "Doz", ratePerUnit: 55 },
      { name: "Santara", unit: "Kg", ratePerUnit: 80 },
      { name: "Amrood", unit: "Kg", ratePerUnit: 140 },
      { name: "Kale Angoor", unit: "Kg", ratePerUnit: 160 },
      { name: "Kiwi", unit: "Peti", ratePerUnit: 1330 },
      { name: "Papita", unit: "Kg", ratePerUnit: 45 },
      { name: "Amrood Imported", unit: "Kg", ratePerUnit: 0 },
      { name: "Dragon Fruit", unit: "Peti", ratePerUnit: 1550 },
      { name: "Angoor", unit: "Kg", ratePerUnit: 160 },
      { name: "Babbu Gosha", unit: "Kg", ratePerUnit: 160 },
      { name: "Kharbuja", unit: "Kg", ratePerUnit: 50 },
      { name: "Ananas Rani", unit: "Peti", ratePerUnit: 940 },
      { name: "Ananas Raja", unit: "Kg", ratePerUnit: 880 },
      { name: "Anar", unit: "Kg", ratePerUnit: 180 },
      { name: "Tarbooj", unit: "Kg", ratePerUnit: 50 },
      { name: "Baby Corn", unit: "Kg", ratePerUnit: 150 },
      { name: "Mausambi", unit: "Kg", ratePerUnit: 80 },
      { name: "Hari Methi", unit: "Kg", ratePerUnit: 60 },
      { name: "Tori", unit: "Kg", ratePerUnit: 80 },
    ],
  },
  // ═══════════════════════════════════════════════════════════════════════
  // 04-Dress (ALL 7 items)
  // ═══════════════════════════════════════════════════════════════════════
  {
    name: "04-Dress",
    ingredients: [
      { name: "Plastic Gloves", unit: "Nos", ratePerUnit: 1 },
      { name: "Spring Cap", unit: "Nos", ratePerUnit: 2 },
      { name: "Kapde Gloves", unit: "Nos", ratePerUnit: 2 },
      { name: "Tshirt And Apron", unit: "Nos", ratePerUnit: 10 },
      { name: "Basket", unit: "Nos", ratePerUnit: 15 },
      { name: "Cook Coat", unit: "Nos", ratePerUnit: 20 },
      { name: "Purane Apron", unit: "Nos", ratePerUnit: 0 },
    ],
  },
  // ═══════════════════════════════════════════════════════════════════════
  // 05-Stall (ALL 12 items)
  // ═══════════════════════════════════════════════════════════════════════
  {
    name: "05-Stall",
    ingredients: [
      { name: "Mocktail Counter", unit: "Nos", ratePerUnit: 18000 },
      { name: "LED Counter", unit: "Nos", ratePerUnit: 30000 },
      { name: "Fruit Counter", unit: "Nos", ratePerUnit: 4500 },
      { name: "Cake Counter", unit: "Nos", ratePerUnit: 0 },
      { name: "Sweet Corn Stall", unit: "Kg", ratePerUnit: 0 },
      { name: "Popcorn", unit: "Nos", ratePerUnit: 0 },
      { name: "Sugar Candy", unit: "Nos", ratePerUnit: 2500 },
      { name: "Salad Counter", unit: "Nos", ratePerUnit: 5000 },
      { name: "Mini Pizza Stall", unit: "Nos", ratePerUnit: 12000 },
      { name: "Bar Counter", unit: "Nos", ratePerUnit: 12000 },
      { name: "Juice Machine", unit: "Nos", ratePerUnit: 2000 },
      { name: "Shake Machine", unit: "Nos", ratePerUnit: 2000 },
    ],
  },
  // ═══════════════════════════════════════════════════════════════════════
  // 06-Pani (ALL 5 items)
  // ═══════════════════════════════════════════════════════════════════════
  {
    name: "06-Pani",
    ingredients: [
      { name: "Paani 20 Ltr", unit: "Nos", ratePerUnit: 50 },
      { name: "Paani 250ml", unit: "Peti", ratePerUnit: 120 },
      { name: "Paani 1 Ltr", unit: "Peti", ratePerUnit: 120 },
      { name: "Soda", unit: "Peti", ratePerUnit: 300 },
      { name: "Bone China", unit: "Nos", ratePerUnit: 50 },
    ],
  },
  // ═══════════════════════════════════════════════════════════════════════
  // 07-Nonveg (ALL 14 items)
  // ═══════════════════════════════════════════════════════════════════════
  {
    name: "07-Nonveg",
    ingredients: [
      { name: "Thai Boneless", unit: "Kg", ratePerUnit: 280 },
      { name: "Indian Basa", unit: "Kg", ratePerUnit: 300 },
      { name: "Chicken", unit: "Kg", ratePerUnit: 180 },
      { name: "Mutton", unit: "Kg", ratePerUnit: 600 },
      { name: "Chicken Keema", unit: "Kg", ratePerUnit: 300 },
      { name: "Mutton Keema", unit: "Kg", ratePerUnit: 650 },
      { name: "Chicken Wings", unit: "Kg", ratePerUnit: 300 },
      { name: "Tandoori Chicken Ready", unit: "Nos", ratePerUnit: 150 },
      { name: "Kachmoli", unit: "Kg", ratePerUnit: 600 },
      { name: "Saboot Bakra", unit: "Nos", ratePerUnit: 0 },
      { name: "Bhutwa", unit: "Kg", ratePerUnit: 300 },
      { name: "Pota Kalezi", unit: "Kg", ratePerUnit: 200 },
      { name: "Singhada Fish", unit: "Kg", ratePerUnit: 300 },
      { name: "Chicken Lollipop Ready", unit: "Kg", ratePerUnit: 200 },
    ],
  },
  // ═══════════════════════════════════════════════════════════════════════
  // 08-Burf (ALL 2 items)
  // ═══════════════════════════════════════════════════════════════════════
  {
    name: "08-Burf",
    ingredients: [
      { name: "Barf", unit: "Kg", ratePerUnit: 10 },
      { name: "Ice Cube", unit: "Kg", ratePerUnit: 20 },
    ],
  },
  // ═══════════════════════════════════════════════════════════════════════
  // 09-Kulfi (ALL 2 items)
  // ═══════════════════════════════════════════════════════════════════════
  {
    name: "09-Kulfi",
    ingredients: [
      { name: "Kulfi", unit: "Nos", ratePerUnit: 15 },
      { name: "Matka Kulfi", unit: "Nos", ratePerUnit: 60 },
    ],
  },
  // ═══════════════════════════════════════════════════════════════════════
  // 10-Icecream (ALL 1 item)
  // ═══════════════════════════════════════════════════════════════════════
  {
    name: "10-Icecream",
    ingredients: [
      { name: "Ice Cream", unit: "Gall", ratePerUnit: 500 },
    ],
  },
  // ═══════════════════════════════════════════════════════════════════════
  // 11-Pan Counter (ALL 2 items)
  // ═══════════════════════════════════════════════════════════════════════
  {
    name: "11-Pan Counter",
    ingredients: [
      { name: "Pan Counter", unit: "Nos", ratePerUnit: 5000 },
      { name: "Paan Mouth Freshner", unit: "Nos", ratePerUnit: 4000 },
    ],
  },
  // ═══════════════════════════════════════════════════════════════════════
  // 12-Koyala (ALL 2 items)
  // ═══════════════════════════════════════════════════════════════════════
  {
    name: "12-Koyala",
    ingredients: [
      { name: "Kacha Koyala", unit: "Kg", ratePerUnit: 40 },
      { name: "Lakdi Gutka", unit: "Kg", ratePerUnit: 14 },
    ],
  },
  // ═══════════════════════════════════════════════════════════════════════
  // 13-Bakery (ALL 3 items)
  // ═══════════════════════════════════════════════════════════════════════
  {
    name: "13-Bakery",
    ingredients: [
      { name: "Bread", unit: "Pkt", ratePerUnit: 30 },
      { name: "Bread Crumbs", unit: "Kg", ratePerUnit: 130 },
      { name: "Veg Sandwich", unit: "Nos", ratePerUnit: 30 },
    ],
  },
  // ═══════════════════════════════════════════════════════════════════════
  // 14 to 26 - Labour & Services Categories
  // ═══════════════════════════════════════════════════════════════════════
  {
    name: "14-Indian Labour",
    ingredients: [
      { name: "Indian Labour", unit: "Nos", ratePerUnit: 1100 },
    ],
  },
  {
    name: "15-Snacks",
    ingredients: [
      { name: "Snacks Labour", unit: "Nos", ratePerUnit: 1100 },
    ],
  },
  {
    name: "16-Chaat",
    ingredients: [
      { name: "Chaat Labour", unit: "Nos", ratePerUnit: 1300 },
    ],
  },
  {
    name: "17-Waiter",
    ingredients: [
      { name: "Waiter", unit: "Nos", ratePerUnit: 650 },
    ],
  },
  {
    name: "18-Tandoor",
    ingredients: [
      { name: "Tandoor Labour", unit: "Nos", ratePerUnit: 1500 },
    ],
  },
  {
    name: "19-Rumali",
    ingredients: [
      { name: "Rumali Labour", unit: "Nos", ratePerUnit: 1200 },
    ],
  },
  {
    name: "20-Ghad Bhoj",
    ingredients: [
      { name: "Ghad Bhoj Labour", unit: "Nos", ratePerUnit: 1000 },
    ],
  },
  {
    name: "21-Coffee Machine",
    ingredients: [
      { name: "Coffee Machine Rent", unit: "Nos", ratePerUnit: 1000 },
    ],
  },
  {
    name: "22-Karbing",
    ingredients: [
      { name: "Carving", unit: "Nos", ratePerUnit: 5500 },
    ],
  },
  {
    name: "23-Kiraya",
    ingredients: [
      { name: "Kiraya", unit: "Nos", ratePerUnit: 0 },
    ],
  },
  {
    name: "25-Tent",
    ingredients: [
      { name: "Gas Bhatti", unit: "Nos", ratePerUnit: 0 },
      { name: "Patile Dhakkan", unit: "Nos", ratePerUnit: 0 },
      { name: "Parat", unit: "Nos", ratePerUnit: 0 },
      { name: "Tuf", unit: "Nos", ratePerUnit: 0 },
      { name: "Thaal", unit: "Nos", ratePerUnit: 0 },
    ],
  },
  {
    name: "26-Pisai",
    ingredients: [
      { name: "Pisai", unit: "Nos", ratePerUnit: 1000 },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// RECIPES - Map menu items to ingredients (using YOUR ingredient names)
// ═══════════════════════════════════════════════════════════════════════════
const recipes: Record<string, string[]> = {
  // WELCOME DRINKS
  "Assorted Cold Drinks": ["Cold Drink"],
  "Jal Jeera": ["Jaljira", "Nimbu", "Pudina", "Kala Namak Pisa", "Namak", "Jeera Pisa", "Barf"],
  "Real Juice": ["Real Juice"],
  "Buzansh Juice": ["Buransh Juice"],
  "Fresh Juice": ["Nimbu", "Chini", "Barf"],
  "Chaanch": ["Chaanch", "Namak", "Jeera Pisa", "Pudina", "Hari Mirch"],
  "Fresh Lime Soda": ["Nimbu", "Soda", "Chini", "Kala Namak Pisa", "Namak", "Barf"],
  "Nimbu Paani": ["Nimbu", "Chini", "Kala Namak Pisa", "Namak", "Pudina"],
  "Adrak Nimbu Paani": ["Nimbu", "Adrak", "Chini", "Kala Namak Pisa", "Namak"],
  "Shakes": ["Doodh", "Chini", "Ice Cream", "Shake Machine"],
  "Mocktails": ["Nimbu", "Soda", "Chini", "Pudina", "Lal Rang", "Barf", "Mocktail Counter"],
  "Thandai": ["Doodh", "Chini", "Badam Giri", "Kaju Tukda", "Choti Elaichi Saboot", "Kesar"],
  "Expresso Coffee": ["Coffee Powder", "Chini", "Doodh"],
  "Coolhar Tea": ["Chai Patti", "Doodh", "Chini", "Adrak", "Choti Elaichi Saboot"],
  "Kashmiri Kawa": ["Green Tea", "Kesar", "Choti Elaichi Saboot", "Dalchini", "Badam Giri"],

  // VEG SOUP & SORBA
  "Veg. Lung Fung Soup": ["Phool Gobhi", "Gajar", "Shimla Mirch", "American Corn", "Arrowroot", "Soya Sauce", "Sirka", "Namak", "Kali Mirch Pisi"],
  "Veg. Hot & Sour Soup": ["Tamatar", "Shimla Mirch", "Gajar", "American Corn", "Soya Sauce", "Sirka", "Mirch Pisi", "Arrowroot", "Namak"],
  "Veg. Sweet Corn Soup": ["American Corn", "Arrowroot", "Makkhan", "Namak", "Kali Mirch Pisi", "Cream"],
  "Veg. Manchow Soup": ["Gajar", "Patta Gobhi", "Shimla Mirch", "Noodles Gili", "Soya Sauce", "Sirka", "Arrowroot", "Namak"],
  "Lemon Coriander Soup": ["Nimbu", "Hara Dhaniya", "Gajar", "Arrowroot", "Makkhan", "Namak", "Kali Mirch Pisi"],
  "Cream of Tomato Soup": ["Tamatar", "Cream", "Makkhan", "Chini", "Namak", "Kali Mirch Pisi"],
  "Veg. Clear Soup": ["Gajar", "Shimla Mirch", "Patta Gobhi", "Hara Pyaj", "Namak", "Kali Mirch Pisi"],
  "Cream of Mushroom Soup": ["Mushroom", "Cream", "Makkhan", "Maida", "Namak", "Kali Mirch Pisi", "Pyaj"],
  "Talumin Soup": ["Noodles Gili", "Gajar", "Patta Gobhi", "Soya Sauce", "Sirka", "Namak", "Arrowroot"],
  "Spanish Corn Soup": ["American Corn", "Shimla Mirch", "Tamatar", "Cream", "Makkhan", "Arrowroot", "Namak"],
  "Tomato Sorba": ["Tamatar", "Pyaj", "Adrak", "Lahsun", "Haldi Pisi", "Namak", "Desi Ghee", "Hara Dhaniya"],
  "Palak Sorba": ["Palak", "Pyaj", "Adrak", "Lahsun", "Desi Ghee", "Namak", "Cream"],
  "Dal Sorba": ["Masoor", "Pyaj", "Tamatar", "Adrak", "Lahsun", "Haldi Pisi", "Desi Ghee", "Nimbu", "Namak"],
  "Veg. Sorba": ["Gajar", "Lauki", "Pyaj", "Tamatar", "Adrak", "Desi Ghee", "Haldi Pisi", "Namak", "Hara Dhaniya"],

  // VEG SNACKS
  "Paneer Tikka": ["Paneer", "Dahi", "Shimla Mirch", "Pyaj", "Mirch Pisi", "Haldi Pisi", "Garam Masala Pisa", "Adrak", "Lahsun", "Namak", "Refined Oil Kg"],
  "Paneer Malai Tikka": ["Paneer", "Cream", "Dahi", "Amul Cheese", "Choti Elaichi Saboot", "Kali Mirch Pisi", "Namak", "Arrowroot"],
  "Paneer Achari Tikka": ["Paneer", "Dahi", "Achar", "Sarson Ka Tel", "Rai", "Saunf Saboot", "Mirch Pisi", "Haldi Pisi", "Namak"],
  "Paneer Afgani Tikka": ["Paneer", "Cream", "Dahi", "Amul Cheese", "Kali Mirch Pisi", "Choti Elaichi Saboot", "Jaiphal", "Arrowroot", "Namak"],
  "Paneer Hariyali Tikka": ["Paneer", "Dahi", "Pudina", "Hara Dhaniya", "Palak", "Hari Mirch", "Adrak", "Lahsun", "Namak"],
  "Keshari Paneer Tikka": ["Paneer", "Dahi", "Cream", "Kesar", "Choti Elaichi Saboot", "Kali Mirch Pisi", "Namak", "Arrowroot"],
  "Paneer Tikka Muglai": ["Paneer", "Cream", "Dahi", "Kaju Tukda", "Kesar", "Choti Elaichi Saboot", "Jaiphal", "Javitri", "Namak"],
  "Chilly Paneer": ["Paneer", "Shimla Mirch", "Pyaj", "Hari Mirch", "Soya Sauce", "Chilli Sauce", "Sirka", "Arrowroot", "Maida", "Adrak", "Lahsun", "Namak"],
  "Paneer 65": ["Paneer", "Dahi", "Maida", "Arrowroot", "Mirch Pisi", "Curry Patta", "Adrak", "Lahsun", "Lal Rang", "Namak"],
  "Paneer Singapuri": ["Paneer", "Shimla Mirch", "Pyaj", "Soya Sauce", "Tomato Sauce", "Arrowroot", "Namak"],
  "Paneer Sahslik": ["Paneer", "Shimla Mirch", "Pyaj", "Tamatar", "Tomato Sauce", "Soya Sauce", "Sirka", "Satay Stick", "Namak"],
  "Thai Paneer": ["Paneer", "Sweet Chilli Sauce", "Soya Sauce", "Adrak", "Lahsun", "Hari Mirch", "Shimla Mirch", "Arrowroot", "Namak"],
  "Paneer Satey Stick": ["Paneer", "Moongfali", "Soya Sauce", "Nimbu", "Adrak", "Lahsun", "Haldi Pisi", "Satay Stick", "Namak"],
  "Paneer Spring Roll": ["Paneer", "Maida", "Patta Gobhi", "Gajar", "Soya Sauce", "Arrowroot", "Refined Oil Kg", "Namak"],
  "Veg. Spring Roll": ["Maida", "Patta Gobhi", "Gajar", "Shimla Mirch", "Noodles Gili", "Soya Sauce", "Sirka", "Arrowroot", "Refined Oil Kg"],
  "Thai Roll": ["Maida", "Patta Gobhi", "Gajar", "Sweet Chilli Sauce", "Soya Sauce", "Arrowroot", "Refined Oil Kg", "Namak"],
  "Cheese Spring Roll": ["Maida", "Amul Cheese", "Patta Gobhi", "Gajar", "Arrowroot", "Refined Oil Kg", "Namak"],
  "Veg. Crispy Roll": ["Maida", "Aaloo", "Matar Safal", "Gajar", "Arrowroot", "Bread Crumbs", "Refined Oil Kg", "Garam Masala Pisa"],
  "Cram Fried Roll": ["Maida", "Cream", "Paneer", "American Corn", "Arrowroot", "Bread Crumbs", "Refined Oil Kg", "Namak"],
  "Spinich Corn Crispy Roll": ["Maida", "Palak", "American Corn", "Paneer", "Arrowroot", "Bread Crumbs", "Refined Oil Kg"],
  "Cheese Jylo Pino Roll": ["Maida", "Amul Cheese", "Shimla Mirch", "Arrowroot", "Refined Oil Kg", "Namak"],
  "Roli Poli Roll": ["Maida", "Paneer", "Shimla Mirch", "Pyaj", "Arrowroot", "Soya Sauce", "Refined Oil Kg"],
  "Veg. Falla Fal": ["Chana Kabuli", "Pyaj", "Lahsun", "Hara Dhaniya", "Jeera Saboot", "Nimbu", "Namak", "Refined Oil Kg"],
  "Veg. Manchurian": ["Patta Gobhi", "Gajar", "Shimla Mirch", "Maida", "Arrowroot", "Soya Sauce", "Chilli Sauce", "Sirka", "Adrak", "Lahsun", "Namak"],
  "Gobhi Manchurian": ["Phool Gobhi", "Maida", "Arrowroot", "Soya Sauce", "Chilli Sauce", "Sirka", "Adrak", "Lahsun", "Namak", "Refined Oil Kg"],
  "Veg. Won Ton": ["Maida", "Patta Gobhi", "Gajar", "Soya Sauce", "Sirka", "Arrowroot", "Refined Oil Kg", "Namak"],
  "Veg. Hara Bhara Kabab": ["Palak", "Matar Safal", "Aaloo", "Hara Dhaniya", "Hari Mirch", "Bread Crumbs", "Arrowroot", "Chat Masala", "Namak"],
  "Veg. Shami Kabab": ["Chana Dal", "Aaloo", "Pyaj", "Adrak", "Hari Mirch", "Hara Dhaniya", "Garam Masala Pisa", "Namak", "Refined Oil Kg"],
  "Veg. Dahi Kabab": ["Dahi", "Paneer", "Bread Crumbs", "Kaju Tukda", "Hari Mirch", "Hara Dhaniya", "Namak", "Refined Oil Kg"],
  "Seasmi Toast": ["Bread", "Paneer", "Til Safed", "Arrowroot", "Hari Mirch", "Hara Dhaniya", "Namak", "Refined Oil Kg"],
  "Golden Coin": ["Aaloo", "Bread Crumbs", "Arrowroot", "Haldi Pisi", "Mirch Pisi", "Namak", "Refined Oil Kg"],
  "Mushroom Kabana": ["Mushroom", "Besan Barik", "Arrowroot", "Mirch Pisi", "Garam Masala Pisa", "Namak", "Refined Oil Kg"],
  "Stuff Mushroom Tikka": ["Mushroom", "Paneer", "Shimla Mirch", "Dahi", "Namak", "Refined Oil Kg"],
  "Mushroom Malai Tikka": ["Mushroom", "Cream", "Dahi", "Amul Cheese", "Kali Mirch Pisi", "Choti Elaichi Saboot", "Arrowroot", "Namak"],
  "Mushroom Achari Tikka": ["Mushroom", "Dahi", "Achar", "Sarson Ka Tel", "Namak", "Mirch Pisi"],
  "Tandoori Mushroom": ["Mushroom", "Dahi", "Mirch Pisi", "Adrak", "Lahsun", "Namak", "Refined Oil Kg"],
  "Mushroom Duplex": ["Mushroom", "Amul Cheese", "Shimla Mirch", "Bread Crumbs", "Arrowroot", "Namak", "Refined Oil Kg"],
  "Mushroom Sigar": ["Mushroom", "Maida", "Amul Cheese", "Arrowroot", "Refined Oil Kg", "Namak"],
  "Chilly Mushroom": ["Mushroom", "Shimla Mirch", "Pyaj", "Soya Sauce", "Chilli Sauce", "Sirka", "Arrowroot", "Maida", "Adrak", "Lahsun", "Namak"],
  "Kurmure Mushroom": ["Mushroom", "Arrowroot", "Maida", "Mirch Pisi", "Namak", "Refined Oil Kg"],
  "Alloo Roll": ["Aaloo", "Maida", "Hara Dhaniya", "Hari Mirch", "Garam Masala Pisa", "Arrowroot", "Refined Oil Kg"],
  "French Fries": ["Aaloo", "Refined Oil Kg", "Namak", "Chat Masala"],
  "Tandoori Alloo": ["Aaloo", "Dahi", "Mirch Pisi", "Adrak", "Lahsun", "Namak", "Refined Oil Kg"],
  "Alloo Nazakat": ["Aaloo", "Paneer", "Kaju Tukda", "Kismis", "Hari Mirch", "Hara Dhaniya", "Garam Masala Pisa", "Arrowroot", "Namak"],
  "Achari Nazakat": ["Aaloo", "Achar", "Sarson Ka Tel", "Paneer", "Hari Mirch", "Namak", "Refined Oil Kg"],
  "Chilly Honey Potato": ["Aaloo", "Shahad", "Arrowroot", "Soya Sauce", "Chilli Sauce", "Hari Mirch", "Lahsun", "Namak"],
  "Chilly Honey Cauliflower": ["Phool Gobhi", "Shahad", "Arrowroot", "Soya Sauce", "Chilli Sauce", "Lahsun", "Namak"],
  "Chilly Honey Brockley": ["Broccoli", "Shahad", "Arrowroot", "Soya Sauce", "Chilli Sauce", "Lahsun", "Namak"],
  "Tandoori Brockley": ["Broccoli", "Dahi", "Mirch Pisi", "Adrak", "Lahsun", "Namak"],
  "Singapuri Gobhi": ["Phool Gobhi", "Soya Sauce", "Chilli Sauce", "Tomato Sauce", "Arrowroot", "Pyaj", "Shimla Mirch", "Namak"],
  "Tandoori Gobhi": ["Phool Gobhi", "Dahi", "Mirch Pisi", "Adrak", "Lahsun", "Namak"],
  "Baby Corn Fry": ["Baby Corn", "Arrowroot", "Maida", "Mirch Pisi", "Namak", "Refined Oil Kg"],
  "Nimbu Mirch Baby Corn": ["Baby Corn", "Nimbu", "Hari Mirch", "Adrak", "Lahsun", "Arrowroot", "Namak"],
  "Crispy Sweet Corn": ["American Corn", "Arrowroot", "Maida", "Mirch Pisi", "Namak", "Refined Oil Kg"],
  "Corn Cake": ["American Corn", "Maida", "Arrowroot", "Shimla Mirch", "Amul Cheese", "Namak", "Refined Oil Kg"],
  "Corn Cheese Toast": ["American Corn", "Amul Cheese", "Bread", "Shimla Mirch", "Hari Mirch", "Makkhan", "Namak"],
  "Cheese Capsicum Roll": ["Amul Cheese", "Shimla Mirch", "Maida", "Arrowroot", "Refined Oil Kg", "Namak"],
  "Spinich Triangle": ["Palak", "Paneer", "Maida", "Adrak", "Hari Mirch", "Namak", "Refined Oil Kg"],
  "Cheese Ball": ["Amul Cheese", "Maida", "Arrowroot", "Bread Crumbs", "Kali Mirch Pisi", "Namak", "Refined Oil Kg"],
  "Matar Paneer Potali": ["Paneer", "Matar Safal", "Maida", "Arrowroot", "Garam Masala Pisa", "Hari Mirch", "Namak"],
  "Urad Dal Pakori": ["Urad Dhuli", "Pyaj", "Hari Mirch", "Adrak", "Hara Dhaniya", "Namak", "Refined Oil Kg", "Hing"],
  "Moong Dal Pakori": ["Mung Dhuli", "Pyaj", "Hari Mirch", "Adrak", "Hara Dhaniya", "Namak", "Refined Oil Kg", "Hing"],
  "Rushbhari": ["Rushbhari", "Besan Barik", "Arrowroot", "Mirch Pisi", "Namak", "Refined Oil Kg"],
  "Chena Murgi": ["Chena Murki"],
  "Mini Gulab Jamun": ["Gulab Jamun", "Mawa", "Chini", "Choti Elaichi Saboot", "Desi Ghee"],
  "Mini Barfi": ["Barfi", "Silver Varak"],
  // CHAAT STALLS
  "Chaat (Bhalle Papdi)": ["Urad Dhuli", "Dahi", "Imli", "Pudina", "Chat Masala", "Mirch Pisi", "Jeera Pisa", "Namak", "Hara Dhaniya", "Barik Sev"],
  "Sakkarkandi Chaat": ["Nimbu", "Chat Masala", "Hari Mirch", "Hara Dhaniya", "Namak"],
  "Raam Laddu": ["Mung Dhuli", "Hing", "Mooli", "Hari Mirch", "Namak", "Refined Oil Kg"],
  "Paneer Gujiya": ["Paneer", "Maida", "Desi Ghee", "Hari Mirch", "Hara Dhaniya", "Garam Masala Pisa", "Namak"],
  "Kaju Puding Bhalla": ["Urad Dhuli", "Kaju Tukda", "Dahi", "Imli", "Chat Masala", "Jeera Pisa", "Namak"],
  "Badam Puding Bhalla": ["Urad Dhuli", "Badam Giri", "Dahi", "Imli", "Chat Masala", "Jeera Pisa", "Namak"],
  "Kanji Bhalla": ["Urad Dhuli", "Rai", "Mirch Pisi", "Namak", "Refined Oil Kg"],
  "Tikki": ["Aaloo", "Matar Safal", "Hara Dhaniya", "Hari Mirch", "Garam Masala Pisa", "Bread Crumbs", "Namak"],
  "Lacchha Tikki": ["Aaloo", "Arrowroot", "Chat Masala", "Namak", "Refined Oil Kg", "Imli", "Pudina"],
  "Corn Tikki": ["American Corn", "Aaloo", "Arrowroot", "Bread Crumbs", "Hari Mirch", "Namak"],
  "Kele Ki Tikki": ["Kacha Kela", "Aaloo", "Bread Crumbs", "Hari Mirch", "Garam Masala Pisa", "Namak"],
  "Chowmein": ["Noodles Gili", "Patta Gobhi", "Gajar", "Shimla Mirch", "Hara Pyaj", "Soya Sauce", "Sirka", "Refined Oil Kg"],
  "Golgappe": ["Suji", "Maida", "Aaloo", "Chana Kabuli", "Imli", "Pudina", "Hari Mirch", "Kala Namak Pisa", "Jeera Pisa"],
  "Dosa": ["Chawal Basmati", "Urad Dhuli", "Refined Oil Kg", "Makkhan", "Aaloo", "Pyaj", "Hari Mirch", "Haldi Pisi", "Rai", "Curry Patta"],
  "Chilla": ["Besan Barik", "Pyaj", "Tamatar", "Hari Mirch", "Hara Dhaniya", "Haldi Pisi", "Namak"],
  "Pav Bhaji": ["Aaloo", "Tamatar", "Pyaj", "Shimla Mirch", "Matar Safal", "Phool Gobhi", "Makkhan", "Pav Bhaji Masala", "Mirch Pisi", "Pav"],
  "Sambhar Bada": ["Urad Dhuli", "Arhar", "Sambhar Masala", "Imli", "Pyaj", "Tamatar", "Curry Patta", "Rai", "Haldi Pisi"],
  "Idly Sambhar": ["Chawal Basmati", "Urad Dhuli", "Arhar", "Sambhar Masala", "Imli", "Tamatar", "Pyaj", "Curry Patta", "Rai"],
  "Raj Kachori": ["Maida", "Mung Dhuli", "Urad Dhuli", "Dahi", "Imli", "Chat Masala", "Barik Sev", "Aaloo", "Chana Kabuli"],
  "Raj Bhoj": ["Maida", "Aaloo", "Paneer", "Matar Safal", "Dahi", "Imli", "Pudina", "Chat Masala", "Barik Sev"],
  "Bhel Puri": ["Murmure", "Barik Sev", "Pyaj", "Tamatar", "Imli", "Pudina", "Chat Masala", "Hari Mirch", "Hara Dhaniya"],
  "Dal Muradabadi": ["Urad Dhuli", "Adrak", "Hari Mirch", "Hing", "Namak", "Refined Oil Kg", "Hara Dhaniya"],

  // SALAD STALLS
  "Green Salad": ["Kheera Desi", "Tamatar", "Pyaj", "Mooli", "Gajar", "Shimla Mirch", "Nimbu", "Namak"],
  "Kachumber Salad": ["Kheera Desi", "Tamatar", "Pyaj", "Hari Mirch", "Hara Dhaniya", "Nimbu", "Namak"],
  "Sprouted Salad": ["Moong Saboot", "Tamatar", "Pyaj", "Nimbu", "Hari Mirch", "Chat Masala", "Namak"],
  "Macroni Salad": ["Macaroni", "Mayonnaise", "Shimla Mirch", "Gajar", "American Corn", "Kali Mirch Pisi"],
  "Russian Salad": ["Aaloo", "Gajar", "Matar Safal", "Apple", "Mayonnaise", "Cream", "Namak"],
  "Fruit & Jelly Salad": ["Apple", "Angoor", "Jelly", "Cream", "Chini"],
  "Green Alloo Salad": ["Aaloo", "Pudina", "Hara Dhaniya", "Hari Mirch", "Nimbu", "Chat Masala", "Namak"],
  "Srika Pyaz": ["Pyaj", "Nimbu", "Mirch Pisi", "Namak"],
  "Salad Counter": ["Kheera Desi", "Tamatar", "Pyaj", "Gajar", "Mooli", "Chukandar", "Nimbu", "Salad Counter"],

  // CURD PREPARATION
  "Plain Curd": ["Dahi"],
  "Pudina Raita": ["Dahi", "Pudina", "Jeera Pisa", "Namak"],
  "Pudina Boondi Raita": ["Dahi", "Raita Boondi", "Pudina", "Jeera Pisa", "Namak", "Mirch Pisi"],
  "Fruit Raita": ["Dahi", "Apple", "Anar", "Angoor", "Chini", "Namak"],
  "Pine Apple Raita": ["Dahi", "Pineapple Slice", "Chini", "Namak", "Kali Mirch Pisi"],
  "Cocktail Raita": ["Dahi", "Kheera Desi", "Tamatar", "Pyaj", "Anar", "Jeera Pisa", "Namak"],
  "Kheera Raita": ["Dahi", "Kheera Desi", "Jeera Pisa", "Pudina", "Namak"],

  // INDIAN BREADS
  "Naan": ["Maida", "Dahi", "Baking Powder", "Chini", "Namak", "Refined Oil Kg", "Tandoor Labour"],
  "Butter Naan": ["Maida", "Dahi", "Baking Powder", "Chini", "Namak", "Makkhan", "Tandoor Labour"],
  "Stuff Naan": ["Maida", "Paneer", "Aaloo", "Hari Mirch", "Dahi", "Makkhan", "Namak", "Tandoor Labour"],
  "Shahi Naan": ["Maida", "Dahi", "Kaju Tukda", "Kismis", "Makkhan", "Namak", "Choti Elaichi Saboot", "Tandoor Labour"],
  "Roti": ["Aatta", "Namak", "Tandoor Labour"],
  "Butter Roti": ["Aatta", "Makkhan", "Namak", "Tandoor Labour"],
  "Tawa Roti": ["Aatta", "Desi Ghee", "Namak"],
  "Lacchha Parantha": ["Maida", "Desi Ghee", "Namak", "Tandoor Labour"],
  "Pudina Parantha": ["Aatta", "Pudina", "Hari Mirch", "Desi Ghee", "Namak", "Tandoor Labour"],
  "Stuff Parantha": ["Aatta", "Aaloo", "Hari Mirch", "Hara Dhaniya", "Desi Ghee", "Namak", "Tandoor Labour"],
  "Puri": ["Maida", "Namak", "Refined Oil Kg"],
  "Palak Puri": ["Maida", "Palak", "Namak", "Ajwain", "Refined Oil Kg"],
  "Missi": ["Besan Barik", "Aatta", "Pyaj", "Hari Mirch", "Hara Dhaniya", "Ajwain", "Namak"],
  "Kachori": ["Maida", "Mung Dhuli", "Saunf Saboot", "Mirch Pisi", "Hing", "Namak", "Refined Oil Kg"],

  // RICE PREPARATION
  "Plain Rice": ["Chawal Basmati", "Namak"],
  "Jeera Rice": ["Chawal Basmati", "Jeera Saboot", "Desi Ghee", "Namak"],
  "Veg. Pullow": ["Chawal Basmati", "Matar Safal", "Gajar", "Phool Gobhi", "Desi Ghee", "Garam Masala Pisa"],
  "Green Peas Pullow": ["Chawal Basmati", "Matar Safal", "Desi Ghee", "Choti Elaichi Saboot", "Laung", "Namak"],
  "Dry Fruit Pullow": ["Chawal Basmati", "Kaju Tukda", "Badam Giri", "Kismis", "Desi Ghee", "Choti Elaichi Saboot", "Kesar"],
  "Kashmiri Pullow": ["Chawal Basmati", "Kaju Tukda", "Badam Giri", "Pineapple Slice", "Cherry", "Kesar", "Desi Ghee", "Choti Elaichi Saboot"],

  // DAL PREPARATION
  "Dal Makhni": ["Urad Saboot", "Rajma", "Makkhan", "Cream", "Tamatar", "Adrak", "Lahsun", "Mirch Pisi", "Garam Masala Pisa"],
  "Rajma Masala": ["Rajma", "Pyaj", "Tamatar", "Adrak", "Lahsun", "Haldi Pisi", "Mirch Pisi", "Garam Masala Pisa", "Namak"],
  "Choley": ["Chana Kabuli", "Pyaj", "Tamatar", "Adrak", "Lahsun", "Haldi Pisi", "Dhaniya Pisa", "Garam Masala Pisa", "Amchur Pisa"],
  "Dal Tadka": ["Arhar", "Pyaj", "Tamatar", "Jeera Saboot", "Rai", "Haldi Pisi", "Mirch Pisi", "Desi Ghee", "Hara Dhaniya"],
  "Dal Bukhara": ["Urad Saboot", "Makkhan", "Cream", "Tamatar", "Adrak", "Lahsun", "Mirch Pisi", "Namak"],
  "Dal Panchrangi": ["Urad Dhuli", "Mung Dhuli", "Masoor", "Chana Dal", "Arhar", "Desi Ghee", "Jeera Saboot", "Haldi Pisi"],
  "Dal Amritsari": ["Chana Dal", "Tamatar", "Pyaj", "Adrak", "Lahsun", "Desi Ghee", "Mirch Pisi", "Garam Masala Pisa"],
  "Dal Peshawari": ["Chana Dal", "Cream", "Adrak", "Hari Mirch", "Desi Ghee", "Jeera Saboot", "Namak"],
  "Masoor Dal": ["Masoor", "Pyaj", "Tamatar", "Haldi Pisi", "Jeera Saboot", "Desi Ghee", "Namak"],
  "Mix Saboot Dal": ["Urad Saboot", "Moong Saboot", "Chana Kabuli", "Pyaj", "Tamatar", "Adrak", "Lahsun", "Haldi Pisi", "Desi Ghee"],
  "Mix Dhuli Dal": ["Urad Dhuli", "Mung Dhuli", "Masoor", "Pyaj", "Tamatar", "Haldi Pisi", "Jeera Saboot", "Desi Ghee"],
  "Lobiya Dal": ["Lobiya", "Pyaj", "Tamatar", "Adrak", "Lahsun", "Haldi Pisi", "Garam Masala Pisa", "Namak"],

  // DRY VEG PREPARATION
  "Mix Veg.": ["Aaloo", "Phool Gobhi", "Matar Safal", "Gajar", "Pyaj", "Tamatar", "Haldi Pisi", "Garam Masala Pisa", "Namak"],
  "Navratan Korma": ["Paneer", "Kaju Tukda", "Matar Safal", "Gajar", "Cream", "Choti Elaichi Saboot", "Haldi Pisi"],
  "Veg. Jalfragi": ["Shimla Mirch", "Pyaj", "Tamatar", "Paneer", "Mushroom", "Baby Corn", "Adrak", "Lahsun", "Garam Masala Pisa"],
  "Alloo Gobhi": ["Aaloo", "Phool Gobhi", "Pyaj", "Haldi Pisi", "Jeera Saboot", "Dhaniya Pisa", "Namak"],
  "Gobhi Masala": ["Phool Gobhi", "Pyaj", "Tamatar", "Haldi Pisi", "Garam Masala Pisa", "Dhaniya Pisa", "Namak"],
  "Gobhi Matar": ["Phool Gobhi", "Matar Safal", "Pyaj", "Tamatar", "Haldi Pisi", "Garam Masala Pisa", "Namak"],
  "Gajar Gobhi Matar": ["Gajar", "Phool Gobhi", "Matar Safal", "Pyaj", "Haldi Pisi", "Garam Masala Pisa", "Namak"],
  "Black Pepper Gobhi": ["Phool Gobhi", "Kali Mirch Pisi", "Pyaj", "Lahsun", "Namak", "Refined Oil Kg"],
  "Boiled Veg.": ["Gajar", "Phool Gobhi", "Broccoli", "Baby Corn", "Matar Safal", "Makkhan", "Kali Mirch Pisi"],
  "Bhindi Masala": ["Bhindi", "Pyaj", "Tamatar", "Haldi Pisi", "Dhaniya Pisa", "Amchur Pisa", "Namak"],
  "Karela Masala": ["Karela Chota", "Pyaj", "Haldi Pisi", "Dhaniya Pisa", "Amchur Pisa", "Namak", "Refined Oil Kg"],
  "Arbi Masala": ["Arbi", "Pyaj", "Haldi Pisi", "Dhaniya Pisa", "Amchur Pisa", "Garam Masala Pisa", "Namak"],
  "Arbi Methi": ["Arbi", "Hari Methi", "Haldi Pisi", "Dhaniya Pisa", "Namak", "Refined Oil Kg"],
  "Alloo Methi": ["Aaloo", "Hari Methi", "Haldi Pisi", "Dhaniya Pisa", "Namak", "Refined Oil Kg"],
  "Jeera Alloo": ["Aaloo", "Jeera Saboot", "Hari Mirch", "Haldi Pisi", "Namak", "Refined Oil Kg", "Hara Dhaniya"],
  "Alloo Patta Gobhi": ["Aaloo", "Patta Gobhi", "Haldi Pisi", "Jeera Saboot", "Namak", "Refined Oil Kg"],
  "Gobhi Gulnaar": ["Phool Gobhi", "Tamatar", "Cream", "Kaju Tukda", "Choti Elaichi Saboot", "Namak", "Desi Ghee"],
  "Mushroom Tikka Tin": ["Mushroom", "Shimla Mirch", "Pyaj", "Dahi", "Namak"],
  "Malai Kathal": ["Cream", "Kaju Tukda", "Pyaj", "Adrak", "Choti Elaichi Saboot", "Namak", "Desi Ghee"],
  "Hari Bhuji": ["Shimla Mirch", "Pyaj", "Tamatar", "Hari Mirch", "Hara Dhaniya", "Haldi Pisi", "Namak"],
  "Tawa Veg": ["Aaloo", "Shimla Mirch", "Pyaj", "Tamatar", "Paneer", "Pav Bhaji Masala", "Makkhan"],

  // GRAVY PREPARATION
  "Mushroom Masala": ["Mushroom", "Pyaj", "Tamatar", "Adrak", "Lahsun", "Haldi Pisi", "Dhaniya Pisa", "Garam Masala Pisa"],
  "Matar Mushroom": ["Mushroom", "Matar Safal", "Pyaj", "Tamatar", "Haldi Pisi", "Garam Masala Pisa", "Namak"],
  "Matar Mushroom Miloni": ["Mushroom", "Matar Safal", "Cream", "Pyaj", "Tamatar", "Kaju Tukda", "Garam Masala Pisa"],
  "Matar Mushroom Makhane": ["Mushroom", "Matar Safal", "Makhana", "Cream", "Pyaj", "Tamatar", "Garam Masala Pisa"],
  "Malai Kofta": ["Paneer", "Aaloo", "Kaju Tukda", "Kismis", "Cream", "Pyaj", "Tamatar", "Adrak", "Lahsun", "Haldi Pisi"],
  "Veg. Kofta": ["Aaloo", "Paneer", "Gajar", "Matar Safal", "Arrowroot", "Pyaj", "Tamatar", "Haldi Pisi", "Garam Masala Pisa"],
  "Louki Kofta": ["Lauki", "Besan Barik", "Pyaj", "Tamatar", "Haldi Pisi", "Garam Masala Pisa", "Namak"],
  "Nargisi Kofta": ["Paneer", "Aaloo", "Matar Safal", "Kaju Tukda", "Pyaj", "Tamatar", "Cream", "Haldi Pisi"],
  "Kashmiri Kofta": ["Paneer", "Kaju Tukda", "Kismis", "Cream", "Kesar", "Choti Elaichi Saboot", "Pyaj", "Tamatar"],
  "Shahi Kofta": ["Paneer", "Kaju Tukda", "Cream", "Pyaj", "Tamatar", "Adrak", "Lahsun", "Kesar", "Garam Masala Pisa"],
  "Shahi Shimla Mirch": ["Shimla Mirch", "Paneer", "Kaju Tukda", "Cream", "Pyaj", "Tamatar", "Garam Masala Pisa"],
  "Soya Chaap Masala": ["Soya Chaap", "Pyaj", "Tamatar", "Dahi", "Adrak", "Lahsun", "Haldi Pisi", "Garam Masala Pisa", "Kasuri Methi"],
  "Palak Corn": ["Palak", "American Corn", "Pyaj", "Adrak", "Lahsun", "Hari Mirch", "Cream", "Namak"],
  "Palak Chana": ["Palak", "Chana Kabuli", "Pyaj", "Adrak", "Lahsun", "Haldi Pisi", "Garam Masala Pisa", "Namak"],
  "Palak Mushroom": ["Palak", "Mushroom", "Pyaj", "Adrak", "Lahsun", "Cream", "Garam Masala Pisa", "Namak"],
  "Alloo Palak": ["Aaloo", "Palak", "Pyaj", "Adrak", "Lahsun", "Haldi Pisi", "Garam Masala Pisa", "Namak"],
  "Palak Kofta": ["Palak", "Paneer", "Besan Barik", "Pyaj", "Cream", "Garam Masala Pisa", "Namak", "Desi Ghee"],
  "Methi Matar Malai": ["Hari Methi", "Matar Safal", "Cream", "Pyaj", "Adrak", "Lahsun", "Choti Elaichi Saboot"],
  "Methi Chaman": ["Hari Methi", "Paneer", "Pyaj", "Tamatar", "Cream", "Garam Masala Pisa", "Namak", "Desi Ghee"],
  "Palak Baby Corn": ["Palak", "Baby Corn", "Pyaj", "Adrak", "Lahsun", "Cream", "Garam Masala Pisa", "Namak"],

  // PANEER PREPARATION
  "Kadai Paneer": ["Paneer", "Shimla Mirch", "Pyaj", "Tamatar", "Dhaniya Pisa", "Jeera Saboot", "Adrak", "Lahsun", "Garam Masala Pisa", "Kasuri Methi"],
  "Shahi Paneer": ["Paneer", "Cream", "Kaju Tukda", "Pyaj", "Tamatar", "Adrak", "Lahsun", "Kesar", "Choti Elaichi Saboot", "Garam Masala Pisa"],
  "Paneer Lababdaar": ["Paneer", "Pyaj", "Tamatar", "Cream", "Makkhan", "Kaju Tukda", "Adrak", "Lahsun", "Garam Masala Pisa", "Kasuri Methi"],
  "Paneer Pasanda": ["Paneer", "Kaju Tukda", "Kismis", "Cream", "Pyaj", "Tamatar", "Adrak", "Garam Masala Pisa", "Kesar"],
  "Paneer Tikka Masala": ["Paneer", "Dahi", "Shimla Mirch", "Pyaj", "Tamatar", "Cream", "Garam Masala Pisa", "Kasuri Methi"],
  "Paneer Butter Masala": ["Paneer", "Makkhan", "Cream", "Tamatar", "Kaju Tukda", "Adrak", "Lahsun", "Mirch Pisi", "Garam Masala Pisa", "Kasuri Methi"],
  "Paneer In White Gravy": ["Paneer", "Cream", "Kaju Tukda", "Pyaj", "Choti Elaichi Saboot", "Kali Mirch Pisi", "Makkhan"],
  "Adriki Dhaniya Paneer": ["Paneer", "Adrak", "Hara Dhaniya", "Pyaj", "Tamatar", "Cream", "Garam Masala Pisa", "Namak"],
  "Paneer Peshawari": ["Paneer", "Cream", "Kaju Tukda", "Nariyal Burada", "Pyaj", "Choti Elaichi Saboot", "Kesar"],
  "Paneer Do Pyaza": ["Paneer", "Pyaj", "Tamatar", "Shimla Mirch", "Adrak", "Lahsun", "Garam Masala Pisa", "Namak"],
  "Paneer Bhurji": ["Paneer", "Pyaj", "Tamatar", "Hari Mirch", "Haldi Pisi", "Hara Dhaniya", "Namak", "Makkhan"],
  "Pudina Paneer": ["Paneer", "Pudina", "Dahi", "Cream", "Pyaj", "Hari Mirch", "Namak", "Desi Ghee"],
  "Paneer Methi Malai": ["Paneer", "Hari Methi", "Cream", "Pyaj", "Adrak", "Lahsun", "Choti Elaichi Saboot"],
  "Palak Paneer": ["Paneer", "Palak", "Pyaj", "Adrak", "Lahsun", "Hari Mirch", "Cream", "Garam Masala Pisa"],
  "Matar Paneer": ["Paneer", "Matar Safal", "Pyaj", "Tamatar", "Adrak", "Lahsun", "Haldi Pisi", "Garam Masala Pisa"],
  "Matar Paneer Mushroom": ["Paneer", "Matar Safal", "Mushroom", "Pyaj", "Tamatar", "Haldi Pisi", "Garam Masala Pisa"],
  "Kalezi Paneer": ["Paneer", "Pota Kalezi", "Pyaj", "Tamatar", "Adrak", "Lahsun", "Haldi Pisi", "Garam Masala Pisa"],

  // MEETHE KA KHAZANA
  "Gulab Jamun": ["Gulab Jamun", "Mawa", "Chini", "Choti Elaichi Saboot", "Desi Ghee"],
  "Imarti Rubri": ["Imarti", "Rabdi", "Kesar", "Choti Elaichi Saboot"],
  "Jalebi Rubri": ["Maida", "Rabdi", "Kesar", "Choti Elaichi Saboot", "Desi Ghee", "Chini"],
  "Malpua Rubri": ["Malpua", "Rabdi", "Choti Elaichi Saboot"],
  "Moong Ka Halwa": ["Moong Halwa"],
  "Gajar Ka Halwa": ["Gajar Halwa"],
  "Chena Kheer": ["Chena Kheer"],
  "Rush Malai": ["Rasmalai"],
  "Rushgulla": ["Rasgulla"],
  "Pine Apple Halwa": ["Pineapple Slice", "Desi Ghee", "Chini", "Choti Elaichi Saboot", "Kaju Tukda", "Nariyal Burada"],
  "Louki Ka Halwa": ["Lauki", "Doodh", "Desi Ghee", "Chini", "Choti Elaichi Saboot", "Kaju Tukda"],
  "Shahi Tukda": ["Bread", "Doodh", "Chini", "Kesar", "Choti Elaichi Saboot", "Desi Ghee", "Rabdi", "Pista", "Badam Giri"],
  "Keshar Malai Ghewar": ["Cream", "Kesar", "Chini", "Choti Elaichi Saboot", "Pista"],
  "Doodh Jalebi": ["Maida", "Doodh", "Chini", "Kesar", "Desi Ghee", "Choti Elaichi Saboot"],
  "Kulhar Doodh": ["Doodh", "Chini", "Choti Elaichi Saboot", "Kesar", "Kulhad"],
  "Ice Cream": ["Ice Cream"],
  "Kulfi": ["Kulfi"],
  "Falooda Kulfi": ["Kulfi", "Sewai", "Doodh", "Chini"],

  // EXTRA STALL
  "Curry Chawal": ["Chawal Basmati", "Aaloo", "Pyaj", "Tamatar", "Haldi Pisi", "Garam Masala Pisa", "Namak"],
  "Chole Kulche": ["Chana Kabuli", "Maida", "Baking Powder", "Dahi", "Pyaj", "Tamatar", "Garam Masala Pisa", "Amchur Pisa"],
  "Khatta Meetha Kaddu": ["Kaddu", "Chini", "Sirka", "Saunf Saboot", "Methi Saboot", "Haldi Pisi", "Mirch Pisi"],
  "Sarso Ka Saag Makki Ki Roti": ["Sarson Saag", "Palak", "Makki Ka Atta", "Desi Ghee", "Adrak", "Lahsun", "Hari Mirch"],
  "Dal Tadka With Fulka": ["Arhar", "Aatta", "Jeera Saboot", "Haldi Pisi", "Lahsun", "Desi Ghee", "Mirch Pisi"],

  // CONTINENTAL
  "Live Pasta": ["Penne Pasta", "Tamatar", "Shimla Mirch", "Mushroom", "Olive Oil", "Lahsun", "Oregano", "Mixed Herbs", "Red Chilli Flakes", "Amul Cheese", "Cream"],
  "Maxica Fateeza": ["Bread", "Mozzarella Cheese", "Shimla Mirch", "Pyaj", "American Corn", "Tomato Sauce", "Oregano", "Red Chilli Flakes"],
  "Baked Veg.": ["Aaloo", "Gajar", "Broccoli", "Phool Gobhi", "Amul Cheese", "Cream", "Makkhan", "Kali Mirch Pisi"],
  "Veg. Lazania": ["Maida", "Mozzarella Cheese", "Tamatar", "Shimla Mirch", "Mushroom", "Cream", "Makkhan", "Oregano"],
  "Veg. Spagati": ["Macaroni", "Tamatar", "Lahsun", "Olive Oil", "Oregano", "Mixed Herbs", "Red Chilli Flakes", "Namak"],
  "Paneer Shaslik": ["Paneer", "Shimla Mirch", "Pyaj", "Tamatar", "Tomato Sauce", "Soya Sauce", "Satay Stick", "Namak"],
  "Mushroom In White Sauce": ["Mushroom", "Cream", "Makkhan", "Maida", "Doodh", "Kali Mirch Pisi", "Namak"],
  "Spinich Corn White Sauce": ["Palak", "American Corn", "Cream", "Makkhan", "Maida", "Doodh", "Kali Mirch Pisi"],
  "Macroni In White Sauce": ["Macaroni", "Cream", "Makkhan", "Maida", "Doodh", "Amul Cheese", "Kali Mirch Pisi"],
  "Paneer In White Sauce": ["Paneer", "Cream", "Makkhan", "Maida", "Doodh", "Kali Mirch Pisi", "Namak"],

  // CHINESE PREPARATION
  "Veg. Chowmein": ["Noodles Gili", "Patta Gobhi", "Gajar", "Shimla Mirch", "Hara Pyaj", "Soya Sauce", "Sirka"],
  "Singapuri Chowmein": ["Noodles Gili", "Patta Gobhi", "Gajar", "Shimla Mirch", "Soya Sauce", "Tomato Sauce"],
  "Veg. Hakka Noodles": ["Noodles Gili", "Patta Gobhi", "Gajar", "Hara Pyaj", "Soya Sauce", "Sirka", "Refined Oil Kg"],
  "Veg. Fried Rice": ["Chawal Basmati", "Gajar", "Matar Safal", "Shimla Mirch", "Hara Pyaj", "Soya Sauce", "Sirka"],
  "Veg. Sweet & Sour": ["Shimla Mirch", "Pineapple Slice", "Pyaj", "Tomato Sauce", "Sirka", "Soya Sauce", "Chini", "Arrowroot"],
  "Veg. Choupsy": ["Noodles Gili", "Patta Gobhi", "Gajar", "Shimla Mirch", "Soya Sauce", "Sirka", "Arrowroot"],
  "Chilly Baby Corn": ["Baby Corn", "Shimla Mirch", "Pyaj", "Soya Sauce", "Chilli Sauce", "Sirka", "Arrowroot", "Adrak", "Lahsun"],
  "Veg. Macaroni": ["Macaroni", "Shimla Mirch", "Gajar", "Pyaj", "Soya Sauce", "Tomato Sauce", "Refined Oil Kg"],
  // NON VEG SOUP & SORBA
  "Chicken Hot & Sour Soup": ["Chicken", "Tamatar", "Shimla Mirch", "Soya Sauce", "Sirka", "Mirch Pisi", "Arrowroot"],
  "Chicken Sweet Corn Soup": ["Chicken", "American Corn", "Arrowroot", "Kali Mirch Pisi", "Namak"],
  "Chicken Lung Fung Soup": ["Chicken", "Phool Gobhi", "Gajar", "American Corn", "Soya Sauce", "Sirka", "Arrowroot"],
  "Chicken Manchow Soup": ["Chicken", "Patta Gobhi", "Gajar", "Noodles Gili", "Soya Sauce", "Sirka", "Arrowroot"],
  "Chicken Talumien Soup": ["Chicken", "Noodles Gili", "Gajar", "Patta Gobhi", "Soya Sauce", "Arrowroot", "Namak"],
  "Chicken Clear Soup": ["Chicken", "Gajar", "Patta Gobhi", "Hara Pyaj", "Kali Mirch Pisi", "Namak"],
  "Chicken Lemon Coriander Soup": ["Chicken", "Nimbu", "Hara Dhaniya", "Gajar", "Arrowroot", "Makkhan"],
  "Chicken Kali Mirch Soup": ["Chicken", "Kali Mirch Pisi", "Cream", "Arrowroot", "Makkhan", "Namak"],
  "Chicken Yakhani Sorba": ["Chicken", "Pyaj", "Adrak", "Lahsun", "Dalchini", "Choti Elaichi Saboot", "Desi Ghee"],
  "Mutton Yakhani Sorba": ["Mutton", "Pyaj", "Adrak", "Lahsun", "Dalchini", "Choti Elaichi Saboot", "Desi Ghee"],

  // CHICKEN STARTER
  "Chicken Tikka": ["Chicken", "Dahi", "Mirch Pisi", "Adrak", "Lahsun", "Nimbu", "Namak"],
  "Chicken Malai Tikka": ["Chicken", "Cream", "Dahi", "Amul Cheese", "Kali Mirch Pisi", "Choti Elaichi Saboot", "Arrowroot"],
  "Chicken Roasted": ["Chicken", "Makkhan", "Adrak", "Lahsun", "Kali Mirch Pisi", "Nimbu", "Garam Masala Pisa"],
  "Chicken Tandoori": ["Chicken", "Dahi", "Mirch Pisi", "Adrak", "Lahsun", "Nimbu", "Lal Rang"],
  "Chicken Afgani": ["Chicken", "Cream", "Dahi", "Amul Cheese", "Kali Mirch Pisi", "Jaiphal", "Arrowroot"],
  "Chicken Pudina Tikka": ["Chicken", "Pudina", "Dahi", "Hara Dhaniya", "Hari Mirch", "Adrak", "Lahsun"],
  "Chicken Kali Mirch Lahsuni Tikka": ["Chicken", "Kali Mirch Pisi", "Lahsun", "Dahi", "Cream", "Nimbu"],
  "Chicken Seekh Kabab": ["Chicken Keema", "Pyaj", "Adrak", "Lahsun", "Hari Mirch", "Hara Dhaniya", "Garam Masala Pisa"],
  "Chicken Gilafi Kabab": ["Chicken Keema", "Pyaj", "Shimla Mirch", "Adrak", "Hari Mirch", "Garam Masala Pisa"],
  "Chicken Reshmi Kabab": ["Chicken Keema", "Cream", "Aande", "Pyaj", "Adrak", "Lahsun", "Kali Mirch Pisi"],
  "Chicken Tangadi Kabab": ["Chicken", "Dahi", "Mirch Pisi", "Adrak", "Lahsun", "Nimbu"],
  "Chicken Shami Kabab": ["Chicken Keema", "Chana Dal", "Pyaj", "Adrak", "Lahsun", "Garam Masala Pisa", "Aande"],
  "Chicken Chilly": ["Chicken", "Shimla Mirch", "Pyaj", "Soya Sauce", "Chilli Sauce", "Sirka", "Arrowroot", "Adrak", "Lahsun"],
  "Chicken Manchurian": ["Chicken", "Maida", "Arrowroot", "Soya Sauce", "Chilli Sauce", "Sirka", "Adrak", "Lahsun"],
  "Lemon Chicken": ["Chicken", "Nimbu", "Arrowroot", "Soya Sauce", "Chini", "Adrak", "Lahsun", "Namak"],
  "Chicken Lollypop": ["Chicken Lollipop Ready", "Maida", "Arrowroot", "Soya Sauce", "Chilli Sauce", "Adrak", "Lahsun", "Aande"],
  "Thai Chicken": ["Chicken", "Sweet Chilli Sauce", "Soya Sauce", "Adrak", "Lahsun", "Arrowroot", "Namak"],
  "Chicken Satay": ["Chicken", "Moongfali", "Soya Sauce", "Nimbu", "Adrak", "Lahsun", "Haldi Pisi", "Satay Stick"],
  "Chicken Joshi Ball": ["Chicken Keema", "Pyaj", "Adrak", "Hari Mirch", "Garam Masala Pisa", "Arrowroot", "Namak"],
  "Chicken Jylo Pino Ball": ["Chicken Keema", "Amul Cheese", "Arrowroot", "Bread Crumbs", "Namak"],
  "Chicken Crispy KFC Style": ["Chicken", "Maida", "Arrowroot", "Aande", "Bread Crumbs", "Kali Mirch Pisi", "Mirch Pisi"],
  "Chicken Dry": ["Chicken", "Pyaj", "Shimla Mirch", "Adrak", "Lahsun", "Haldi Pisi", "Mirch Pisi", "Garam Masala Pisa"],

  // MUTTON STARTER
  "Mutton Tikka": ["Mutton", "Dahi", "Adrak", "Lahsun", "Nimbu", "Namak"],
  "Mutton Pudina Seekh": ["Mutton Keema", "Pudina", "Pyaj", "Adrak", "Lahsun", "Garam Masala Pisa", "Namak"],
  "Mutton Kalongi Seekh": ["Mutton Keema", "Pyaj", "Adrak", "Lahsun", "Garam Masala Pisa", "Namak"],
  "Mutton Boti Kabab": ["Mutton", "Dahi", "Adrak", "Lahsun", "Garam Masala Pisa", "Nimbu", "Namak"],
  "Mutton Shami Kabab": ["Mutton Keema", "Chana Dal", "Pyaj", "Adrak", "Lahsun", "Garam Masala Pisa", "Aande"],
  "Mutton Kakori Kabab": ["Mutton Keema", "Kaju Tukda", "Choti Elaichi Saboot", "Dalchini", "Jaiphal", "Desi Ghee"],
  "Mutton Seekh Kabab": ["Mutton Keema", "Pyaj", "Adrak", "Lahsun", "Hari Mirch", "Hara Dhaniya", "Garam Masala Pisa"],
  "Mutton Banjara Kabab": ["Mutton", "Dahi", "Pyaj", "Adrak", "Lahsun", "Nimbu"],
  "Mutton Adraki Chaap": ["Mutton", "Adrak", "Dahi", "Lahsun", "Garam Masala Pisa", "Nimbu", "Namak"],
  "Mutton Tawa": ["Mutton", "Pyaj", "Shimla Mirch", "Tamatar", "Adrak", "Lahsun", "Garam Masala Pisa"],
  "Mutton Balls": ["Mutton Keema", "Pyaj", "Adrak", "Garam Masala Pisa", "Arrowroot", "Namak", "Refined Oil Kg"],
  "Mutton Dry": ["Mutton", "Pyaj", "Adrak", "Lahsun", "Haldi Pisi", "Mirch Pisi", "Garam Masala Pisa"],
  "Mutton Bhuna": ["Mutton", "Pyaj", "Tamatar", "Adrak", "Lahsun", "Dahi", "Haldi Pisi", "Garam Masala Pisa"],
  "Mutton Bar-B-Que": ["Mutton", "Dahi", "Sirka", "Soya Sauce", "Adrak", "Lahsun", "Kali Mirch Pisi", "Shahad", "Satay Stick"],
  "Mutton Joshi Ball": ["Mutton Keema", "Pyaj", "Adrak", "Hari Mirch", "Garam Masala Pisa", "Arrowroot"],
  "Bhutwa": ["Bhutwa", "Pyaj", "Tamatar", "Adrak", "Lahsun", "Hari Mirch", "Haldi Pisi", "Garam Masala Pisa"],
  "Kalezi": ["Pota Kalezi", "Pyaj", "Tamatar", "Adrak", "Lahsun", "Haldi Pisi", "Garam Masala Pisa"],

  // FISH STARTER
  "Fish Tikka": ["Indian Basa", "Dahi", "Adrak", "Lahsun", "Nimbu", "Namak"],
  "Fish Kali Mirch Tikka": ["Indian Basa", "Kali Mirch Pisi", "Dahi", "Cream", "Nimbu", "Namak"],
  "Fish Mangalorean Tikka": ["Indian Basa", "Mirch Pisi", "Dahi", "Haldi Pisi", "Curry Patta"],
  "Fish Malai Tikka": ["Indian Basa", "Cream", "Dahi", "Amul Cheese", "Kali Mirch Pisi", "Choti Elaichi Saboot", "Arrowroot"],
  "Fish Hariyali Tikka": ["Indian Basa", "Pudina", "Hara Dhaniya", "Dahi", "Hari Mirch", "Namak"],
  "Fish Ajwaini Tikka": ["Indian Basa", "Ajwain", "Dahi", "Besan Barik", "Mirch Pisi", "Namak"],
  "Fish Amritsari": ["Indian Basa", "Besan Barik", "Ajwain", "Mirch Pisi", "Adrak", "Lahsun", "Namak"],
  "Fish Fry": ["Indian Basa", "Haldi Pisi", "Mirch Pisi", "Namak", "Nimbu", "Refined Oil Kg"],
  "Fish Pakora": ["Indian Basa", "Besan Barik", "Mirch Pisi", "Ajwain", "Namak", "Refined Oil Kg"],
  "Fish Finger": ["Indian Basa", "Bread Crumbs", "Aande", "Maida", "Kali Mirch Pisi", "Namak"],
  "Fish Chilly": ["Indian Basa", "Shimla Mirch", "Pyaj", "Soya Sauce", "Chilli Sauce", "Sirka", "Arrowroot", "Adrak", "Lahsun"],
  "Fish Chilly Thai Style": ["Indian Basa", "Sweet Chilli Sauce", "Soya Sauce", "Adrak", "Lahsun", "Arrowroot"],
  "Tandoori Lobester": ["Singhada Fish", "Dahi", "Adrak", "Lahsun", "Nimbu", "Namak"],
  "Tandoori Pomfret": ["Singhada Fish", "Dahi", "Adrak", "Lahsun", "Nimbu", "Namak"],
  // CHICKEN MAIN COURSE
  "Butter Chicken": ["Chicken", "Makkhan", "Cream", "Tamatar", "Kaju Tukda", "Adrak", "Lahsun", "Garam Masala Pisa", "Kasuri Methi", "Mirch Pisi"],
  "Chicken Kali Mirch": ["Chicken", "Kali Mirch Pisi", "Cream", "Pyaj", "Adrak", "Lahsun", "Choti Elaichi Saboot", "Desi Ghee"],
  "Kadai Chicken": ["Chicken", "Shimla Mirch", "Pyaj", "Tamatar", "Dhaniya Pisa", "Jeera Saboot", "Garam Masala Pisa", "Kasuri Methi"],
  "Chicken Tikka Masala": ["Chicken", "Dahi", "Cream", "Pyaj", "Tamatar", "Garam Masala Pisa", "Kasuri Methi"],
  "Chicken Do Pyaza": ["Chicken", "Pyaj", "Tamatar", "Adrak", "Lahsun", "Garam Masala Pisa", "Haldi Pisi", "Namak"],
  "Chicken Curry": ["Chicken", "Pyaj", "Tamatar", "Adrak", "Lahsun", "Haldi Pisi", "Dhaniya Pisa", "Garam Masala Pisa"],
  "Murg Musalam": ["Chicken", "Dahi", "Kaju Tukda", "Pyaj", "Adrak", "Lahsun", "Kesar", "Garam Masala Pisa", "Aande", "Desi Ghee"],
  "Chicken Peshawari": ["Chicken", "Cream", "Kaju Tukda", "Nariyal Burada", "Choti Elaichi Saboot", "Kesar", "Desi Ghee"],
  "Chicken Lababdaar": ["Chicken", "Cream", "Makkhan", "Kaju Tukda", "Pyaj", "Tamatar", "Garam Masala Pisa", "Kasuri Methi"],
  "Chicken Korma": ["Chicken", "Dahi", "Kaju Tukda", "Pyaj", "Cream", "Choti Elaichi Saboot", "Dalchini", "Desi Ghee"],
  "Chicken Muglai": ["Chicken", "Cream", "Kaju Tukda", "Dahi", "Kesar", "Choti Elaichi Saboot", "Javitri", "Pyaj", "Desi Ghee"],
  "Adraki Dhaniya Chicken": ["Chicken", "Adrak", "Hara Dhaniya", "Pyaj", "Tamatar", "Cream", "Garam Masala Pisa", "Desi Ghee"],
  "Chicken Sagwala": ["Chicken", "Palak", "Pyaj", "Adrak", "Lahsun", "Cream", "Garam Masala Pisa", "Desi Ghee"],
  "Chicken Methi Changezi": ["Chicken", "Hari Methi", "Dahi", "Cream", "Pyaj", "Tamatar", "Garam Masala Pisa", "Makkhan"],

  // MUTTON MAIN COURSE
  "Mutton Masala": ["Mutton", "Pyaj", "Tamatar", "Adrak", "Lahsun", "Haldi Pisi", "Dhaniya Pisa", "Garam Masala Pisa"],
  "Mutton Curry": ["Mutton", "Pyaj", "Tamatar", "Adrak", "Lahsun", "Haldi Pisi", "Garam Masala Pisa", "Namak"],
  "Mutton Rara": ["Mutton", "Mutton Keema", "Pyaj", "Tamatar", "Adrak", "Lahsun", "Garam Masala Pisa", "Desi Ghee"],
  "Mutton Rogan Josh": ["Mutton", "Dahi", "Pyaj", "Adrak", "Lahsun", "Kesar", "Saunf Saboot", "Garam Masala Pisa", "Mirch Pisi"],
  "Mutton Shahi Korma": ["Mutton", "Cream", "Kaju Tukda", "Dahi", "Pyaj", "Kesar", "Choti Elaichi Saboot", "Garam Masala Pisa"],
  "Mutton Do Pyaza": ["Mutton", "Pyaj", "Tamatar", "Adrak", "Lahsun", "Garam Masala Pisa", "Haldi Pisi"],
  "Mutton Hydrabadi": ["Mutton", "Dahi", "Pyaj", "Tamatar", "Adrak", "Lahsun", "Kesar"],
  "Nizami Mutton Curry": ["Mutton", "Kaju Tukda", "Cream", "Pyaj", "Dahi", "Kesar", "Javitri", "Garam Masala Pisa"],
  "Mutton Nihari": ["Mutton", "Pyaj", "Adrak", "Lahsun", "Desi Ghee", "Aatta", "Nimbu", "Hara Dhaniya"],
  "Mutton Kalongi": ["Mutton", "Pyaj", "Tamatar", "Adrak", "Lahsun", "Garam Masala Pisa", "Namak"],
  "Mutton Kolapuri": ["Mutton", "Pyaj", "Tamatar", "Nariyal Burada", "Adrak", "Lahsun", "Mirch Pisi", "Garam Masala Pisa"],
  "Bhuna Gosht": ["Mutton", "Pyaj", "Tamatar", "Dahi", "Adrak", "Lahsun", "Garam Masala Pisa", "Desi Ghee"],
  "Bhuna Saag": ["Mutton", "Palak", "Sarson Saag", "Pyaj", "Adrak", "Lahsun", "Garam Masala Pisa", "Desi Ghee"],

  // FISH MAIN COURSE
  "Fish Curry": ["Indian Basa", "Pyaj", "Tamatar", "Adrak", "Lahsun", "Haldi Pisi", "Dhaniya Pisa", "Mirch Pisi", "Sarson Ka Tel"],
  "Fish Masala": ["Indian Basa", "Pyaj", "Tamatar", "Adrak", "Lahsun", "Haldi Pisi", "Garam Masala Pisa"],
  "Fish Tikka Masala": ["Indian Basa", "Dahi", "Cream", "Pyaj", "Tamatar", "Garam Masala Pisa", "Kasuri Methi"],
  "Fish Hydrabadi": ["Indian Basa", "Dahi", "Pyaj", "Tamatar", "Kesar", "Adrak", "Lahsun"],
  "Fish Spicy Ginger Honey": ["Indian Basa", "Adrak", "Shahad", "Soya Sauce", "Mirch Pisi", "Arrowroot", "Lahsun"],
  "Olive Fish": ["Indian Basa", "Green Olive", "Tamatar", "Lahsun", "Olive Oil", "Nimbu", "Kali Mirch Pisi"],

  // AVAILABLE ON ORDER
  "Pudding & Pastry Shop": ["Maida", "Chini", "Aande", "Makkhan", "Cream", "Baking Powder"],
  "Fresh Fruit Counter": ["Apple", "Angoor", "Anar", "Papita", "Fruit Counter"],
  "Ice Cream Parlour": ["Ice Cream"],
  "L.E.D. Counter": ["LED Counter"],
  "Panjabi Dhaba": ["Aatta", "Desi Ghee", "Pyaj", "Tamatar", "Garam Masala Pisa", "Namak"],
  "Coffee Shop": ["Coffee Powder", "Doodh", "Chini", "Coffee Machine Rent"],
  "Sweet Corn": ["American Corn", "Makkhan", "Nimbu", "Chat Masala", "Namak"],
  "Gadh Bhoj": ["Aatta", "Desi Ghee", "Dahi", "Pyaj", "Tamatar", "Garam Masala Pisa", "Ghad Bhoj Labour"],
  "Counti": ["Maida", "Chini", "Makkhan", "Cream", "Choti Elaichi Saboot", "Namak"],
  "Pizza": ["Bread", "Mozzarella Cheese", "Shimla Mirch", "Pyaj", "Tamatar", "American Corn", "Oregano", "Red Chilli Flakes", "Tomato Sauce"],
  "Thai": ["Noodles Gili", "Sweet Chilli Sauce", "Soya Sauce", "Patta Gobhi", "Gajar", "Namak"],
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SEED FUNCTION
// ═══════════════════════════════════════════════════════════════════════════
async function main(): Promise<void> {
  console.log("🌱 Seeding ingredients and recipes...\n");

  const categoryIds: Record<string, string> = {};

  // STEP 1: Seed Ingredient Categories
  console.log("📁 Seeding ingredient categories...");
  for (const cat of ingredientData) {
    const record = await prisma.ingredientCategory.upsert({
      where: { name_userId: { name: cat.name, userId: USER_ID } },
      update: {},
      create: { name: cat.name, userId: USER_ID },
    });
    categoryIds[cat.name] = record.id;
    console.log(`   ✓ ${cat.name} (${cat.ingredients.length} ingredients)`);
  }
  console.log(`✅ ${Object.keys(categoryIds).length} categories seeded\n`);

  // STEP 2: Seed Ingredients
  console.log("🧂 Seeding ingredients...");
  let ingredientCount = 0;
  for (const cat of ingredientData) {
    const categoryId = categoryIds[cat.name];
    for (const ing of cat.ingredients) {
      await prisma.ingredient.upsert({
        where: { name_categoryId_userId: { name: ing.name, categoryId, userId: USER_ID } },
        update: { unit: ing.unit, ratePerUnit: ing.ratePerUnit },
        create: { name: ing.name, unit: ing.unit, ratePerUnit: ing.ratePerUnit, categoryId, userId: USER_ID },
      });
      ingredientCount++;
    }
  }
  console.log(`✅ ${ingredientCount} ingredients seeded\n`);

  // STEP 3: Seed Recipes (ItemIngredient links)
  console.log("📋 Seeding recipes...");
  const allItems = await prisma.item.findMany({ where: { userId: USER_ID }, select: { id: true, name: true } });
  const allIngredients = await prisma.ingredient.findMany({ where: { userId: USER_ID }, select: { id: true, name: true } });
  const ingredientMap = new Map(allIngredients.map((i) => [i.name, i.id]));

  let totalRecipes = 0;
  let totalLinks = 0;
  const missingItems: string[] = [];
  const missingIngredients: string[] = [];

  for (const item of allItems) {
    const recipeIngredients = recipes[item.name];
    if (!recipeIngredients) { missingItems.push(item.name); continue; }
    totalRecipes++;
    for (const ingName of recipeIngredients) {
      const ingredientId = ingredientMap.get(ingName);
      if (!ingredientId) { missingIngredients.push(`"${ingName}" (for: ${item.name})`); continue; }
      await prisma.itemIngredient.upsert({
        where: { itemId_ingredientId: { itemId: item.id, ingredientId } },
        update: {},
        create: { itemId: item.id, ingredientId },
      });
      totalLinks++;
    }
  }

  console.log(`✅ Recipes seeded: ${totalRecipes} items linked`);
  console.log(`   Total item↔ingredient links: ${totalLinks}`);

  if (missingItems.length > 0) {
    console.log(`\n⚠️  Menu items without recipes (${missingItems.length}):`);
    missingItems.slice(0, 15).forEach(name => console.log(`   - ${name}`));
    if (missingItems.length > 15) console.log(`   ... and ${missingItems.length - 15} more`);
  }

  if (missingIngredients.length > 0) {
    const unique = [...new Set(missingIngredients)];
    console.log(`\n⚠️  Missing ingredients (${unique.length}):`);
    unique.slice(0, 15).forEach(name => console.log(`   - ${name}`));
    if (unique.length > 15) console.log(`   ... and ${unique.length - 15} more`);
  }

  console.log("\n🎉 Ingredient & Recipe seeding complete!");
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => { console.error("❌ Seed failed:", e); await prisma.$disconnect(); process.exit(1); });