#!/bin/bash
# Fix Double Subscription - 15 March 2026
# Total affected users: 14
# Each user got 26 extra days (54 instead of 28)

BASE_URL="https://www.parasreward.com/api/admin/fix-user-subscription-days"

echo "=========================================="
echo "FIXING DOUBLE SUBSCRIPTIONS - 14 Users"
echo "=========================================="

# User 1: Gajendra Sonar
echo "Fixing: Gajendra Sonar (8830307280)..."
curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{"mobile": "8830307280", "days_to_remove": 26, "reason": "Double subscription fix - 15 Mar 2026", "admin_id": "Admin@paras.com"}'
echo -e "\n"

# User 2: Vikas Madhavrao Deshmukh
echo "Fixing: Vikas Madhavrao Deshmukh (7776886043)..."
curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{"mobile": "7776886043", "days_to_remove": 26, "reason": "Double subscription fix - 15 Mar 2026", "admin_id": "Admin@paras.com"}'
echo -e "\n"

# User 3: Pavez
echo "Fixing: Pavez (8327a6c25-abba-4769-9951-a197f4ccefe9)..."
curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "8327a6c25-abba-4769-9951-a197f4ccefe9", "days_to_remove": 26, "reason": "Double subscription fix - 15 Mar 2026", "admin_id": "Admin@paras.com"}'
echo -e "\n"

# User 4: parvezcube@gmail.com user
echo "Fixing: Parvez (parvezcube)..."
curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "7e5ff5cec-f64f-4ba8-9ddd-c17d9aefe394", "days_to_remove": 26, "reason": "Double subscription fix - 15 Mar 2026", "admin_id": "Admin@paras.com"}'
echo -e "\n"

# User 5: Ricky Kamil
echo "Fixing: Ricky Kamil (6355519754)..."
curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{"mobile": "6355519754", "days_to_remove": 26, "reason": "Double subscription fix - 15 Mar 2026", "admin_id": "Admin@paras.com"}'
echo -e "\n"

# User 6: Chhaya Anand
echo "Fixing: Chhaya Anand (9550983228)..."
curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{"mobile": "9550983228", "days_to_remove": 26, "reason": "Double subscription fix - 15 Mar 2026", "admin_id": "Admin@paras.com"}'
echo -e "\n"

# User 7: Roopa (25 extra days)
echo "Fixing: Roopa (9304724301)..."
curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{"mobile": "9304724301", "days_to_remove": 25, "reason": "Double subscription fix - 15 Mar 2026", "admin_id": "Admin@paras.com"}'
echo -e "\n"

# User 8: Chhavilal Chauhan
echo "Fixing: Chhavilal Chauhan (7878948814)..."
curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{"mobile": "7878948814", "days_to_remove": 26, "reason": "Double subscription fix - 15 Mar 2026", "admin_id": "Admin@paras.com"}'
echo -e "\n"

# User 9: Utpal Suttradhar
echo "Fixing: Utpal Suttradhar (7996947070)..."
curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{"mobile": "7996947070", "days_to_remove": 26, "reason": "Double subscription fix - 15 Mar 2026", "admin_id": "Admin@paras.com"}'
echo -e "\n"

# User 10: Mudita
echo "Fixing: Mudita (6302535904)..."
curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{"mobile": "6302535904", "days_to_remove": 26, "reason": "Double subscription fix - 15 Mar 2026", "admin_id": "Admin@paras.com"}'
echo -e "\n"

# User 11: Khadia
echo "Fixing: Khadia (9264492883)..."
curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{"mobile": "9264492883", "days_to_remove": 26, "reason": "Double subscription fix - 15 Mar 2026", "admin_id": "Admin@paras.com"}'
echo -e "\n"

# User 12: Sheetlabodake
echo "Fixing: Sheetlabodake (9172044424)..."
curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{"mobile": "9172044424", "days_to_remove": 26, "reason": "Double subscription fix - 15 Mar 2026", "admin_id": "Admin@paras.com"}'
echo -e "\n"

# User 13: Ravinderpaswaan (aags user)
echo "Fixing: Ravinderpaswaan (9322140373)..."
curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{"mobile": "9322140373", "days_to_remove": 26, "reason": "Double subscription fix - 15 Mar 2026", "admin_id": "Admin@paras.com"}'
echo -e "\n"

# User 14: Sameer Yalin
echo "Fixing: Sameer Yalin (8169070232)..."
curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{"mobile": "8169070232", "days_to_remove": 26, "reason": "Double subscription fix - 15 Mar 2026", "admin_id": "Admin@paras.com"}'
echo -e "\n"

echo "=========================================="
echo "FIX COMPLETE - Check results above"
echo "=========================================="
