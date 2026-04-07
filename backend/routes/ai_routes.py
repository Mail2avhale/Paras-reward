from fastapi import APIRouter, HTTPException, Query, Request, File, UploadFile, Form
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import logging
import json
import uuid

router = APIRouter(prefix="/ai", tags=["AI Chatbot"])

db = None

def set_db(database):
    global db
    db = database

@router.post("/chatbot")
async def ai_chatbot(
    uid: str,
    message: str,
    session_id: Optional[str] = None
):
    """AI Chatbot - DEPRECATED March 2026"""
    return {
        "response": "🚫 Chatbot feature has been deprecated. Please use the main menu to access all features:\n\n• Bill Payments → Menu → Redeem\n• Bank Transfer → Contact Support\n• Help → Menu → Support",
        "session_id": session_id or f"deprecated_{uid}",
        "auto_approved": False,
        "deprecated": True
    }


# Old chatbot withdrawal handling code removed - feature deprecated March 2026
# See git history for original implementation


@router.get("/chatbot/history/{uid}")
async def get_chatbot_history(uid: str, limit: int = 50):
    """Get chatbot conversation history - DEPRECATED"""
    return {
        "history": [],
        "deprecated": True,
        "message": "Chatbot feature has been deprecated"
    }


# Chatbot withdrawal flow code removed - feature deprecated March 2026


@router.post("/kyc-verify")
async def ai_kyc_verify(
    uid: str,
    document_type: str,  # aadhaar, pan
    image_base64: str,
    entered_name: str,
    entered_number: str  # Aadhaar number or PAN number
):
    """AI-powered KYC document verification"""
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="AI service not configured")
    
    # Validate document type
    if document_type not in ["aadhaar", "pan"]:
        raise HTTPException(status_code=400, detail="Invalid document type. Use 'aadhaar' or 'pan'")
    
    # Create verification prompt
    if document_type == "aadhaar":
        verification_prompt = f"""Analyze this Aadhaar Card image and extract the following information:
1. Full Name on the card
2. Aadhaar Number (12 digits)
3. Date of Birth (if visible)
4. Gender (if visible)

User entered:
- Name: {entered_name}
- Aadhaar Number: {entered_number}

Compare the extracted data with user-entered data and respond in this JSON format:
{{
    "extracted_name": "name from card",
    "extracted_number": "number from card",
    "name_match": true/false,
    "number_match": true/false,
    "confidence": 0-100,
    "is_valid_document": true/false,
    "verification_status": "approved" or "manual_review" or "rejected",
    "reason": "explanation in English"
}}

If the image is not clear or not an Aadhaar card, set is_valid_document to false."""
    else:
        verification_prompt = f"""Analyze this PAN Card image and extract the following information:
1. Full Name on the card
2. PAN Number (10 characters - ABCDE1234F format)
3. Father's Name (if visible)
4. Date of Birth (if visible)

User entered:
- Name: {entered_name}
- PAN Number: {entered_number}

Compare the extracted data with user-entered data and respond in this JSON format:
{{
    "extracted_name": "name from card",
    "extracted_number": "number from card",
    "name_match": true/false,
    "number_match": true/false,
    "confidence": 0-100,
    "is_valid_document": true/false,
    "verification_status": "approved" or "manual_review" or "rejected",
    "reason": "explanation in English"
}}

If the image is not clear or not a PAN card, set is_valid_document to false."""

    try:
        # Create chat instance for KYC verification
        kyc_chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"kyc_{uid}_{document_type}_{str(uuid.uuid4())[:8]}",
            system_message="You are a KYC document verification expert. Analyze documents accurately and provide verification results in JSON format only."
        ).with_model("gemini", "gemini-2.5-flash")
        
        # Create message with image
        image_content = ImageContent(image_base64=image_base64)
        user_msg = UserMessage(
            text=verification_prompt,
            file_contents=[image_content]
        )
        
        # Get AI response
        response = await kyc_chat.send_message(user_msg)
        
        # Parse JSON response
        import json
        try:
            # Extract JSON from response
            json_start = response.find('{')
            json_end = response.rfind('}') + 1
            if json_start != -1 and json_end > json_start:
                result = json.loads(response[json_start:json_end])
            else:
                result = {
                    "verification_status": "manual_review",
                    "reason": "AI response parsing failed",
                    "confidence": 0
                }
        except json.JSONDecodeError:
            result = {
                "verification_status": "manual_review",
                "reason": "AI response parsing failed",
                "confidence": 0
            }
        
        # Log KYC verification attempt
        kyc_log = {
            "uid": uid,
            "document_type": document_type,
            "entered_name": entered_name,
            "entered_number": entered_number[-4:] if len(entered_number) > 4 else "****",  # Only last 4 digits for security
            "ai_result": result,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await db.kyc_ai_logs.insert_one(kyc_log)
        
        # If auto-approved, update user KYC status
        if result.get("verification_status") == "approved" and result.get("confidence", 0) >= 80:
            update_field = f"kyc_{document_type}_verified" 
            await db.users.update_one(
                {"uid": uid},
                {"$set": {
                    update_field: True,
                    f"kyc_{document_type}_verified_at": datetime.now(timezone.utc).isoformat(),
                    f"kyc_{document_type}_method": "ai_auto"
                }}
            )
            
            # Check if both documents are verified for full KYC approval
            user = await db.users.find_one({"uid": uid})
            if user.get("kyc_aadhaar_verified") and user.get("kyc_pan_verified"):
                await db.users.update_one(
                    {"uid": uid},
                    {"$set": {
                        "kyc_status": "verified",
                        "kyc_approved_at": datetime.now(timezone.utc).isoformat(),
                        "kyc_approved_by": "AI_AUTO"
                    }}
                )
                result["full_kyc_approved"] = True
        
        return {
            "document_type": document_type,
            "verification_result": result,
            "auto_approved": result.get("verification_status") == "approved" and result.get("confidence", 0) >= 80
        }
        
    except Exception as e:
        logging.error(f"KYC AI verification error: {e}")
        return {
            "document_type": document_type,
            "verification_result": {
                "verification_status": "manual_review",
                "reason": f"AI verification failed: {str(e)}",
                "confidence": 0
            },
            "auto_approved": False
        }

@router.get("/chatbot/history/{uid}")
async def get_chatbot_history(uid: str, limit: int = 50):
    """Get chatbot conversation history for a user"""
    history = await db.chatbot_logs.find(
        {"uid": uid},
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    return {"history": history}


# ========== VOICE AI ENDPOINTS ==========
# Speech-to-Text (Whisper) and Text-to-Speech (TTS)

@router.post("/voice/transcribe")
async def transcribe_audio(audio_file: UploadFile = File(...)):
    """Convert speech to text using OpenAI Whisper"""
    try:
        from emergentintegrations.llm.openai import OpenAISpeechToText
        
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="Voice API not configured")
        
        # Read audio file
        audio_content = await audio_file.read()
        
        # Check file size (25MB limit)
        if len(audio_content) > 25 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Audio file too large. Max 25MB.")
        
        # Initialize STT
        stt = OpenAISpeechToText(api_key=api_key)
        
        # Create a file-like object
        import io
        audio_io = io.BytesIO(audio_content)
        audio_io.name = audio_file.filename or "audio.webm"
        
        # Transcribe
        response = await stt.transcribe(
            file=audio_io,
            model="whisper-1",
            response_format="json",
            language="en"  # Auto-detect if not specified
        )
        
        return {
            "success": True,
            "text": response.text,
            "language": "auto"
        }
        
    except Exception as e:
        logging.error(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")


@router.post("/voice/speak")
async def text_to_speech(text: str = Form(...), voice: str = Form("nova"), speed: float = Form(1.0)):
    """Convert text to speech using OpenAI TTS"""
    try:
        from emergentintegrations.llm.openai import OpenAITextToSpeech
        
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="Voice API not configured")
        
        # Check text length (4096 char limit)
        if len(text) > 4096:
            text = text[:4096]
        
        # Initialize TTS
        tts = OpenAITextToSpeech(api_key=api_key)
        
        # Generate speech as base64
        audio_base64 = await tts.generate_speech_base64(
            text=text,
            model="tts-1",  # Use standard model for faster response
            voice=voice,  # nova, alloy, shimmer, echo, fable, onyx
            speed=speed
        )
        
        return {
            "success": True,
            "audio_base64": audio_base64,
            "format": "mp3",
            "voice": voice
        }
        
    except Exception as e:
        logging.error(f"TTS error: {e}")
        raise HTTPException(status_code=500, detail=f"Text-to-speech failed: {str(e)}")


@router.get("/proactive-tips/{uid}")
async def get_proactive_tips(uid: str, current_page: str = "dashboard"):
    """Get AI-powered proactive tips based on user state and current page"""
    try:
        # Get user data
        user = await db.users.find_one({"uid": uid}, {"_id": 0})
        if not user:
            return {"tips": [], "actions": []}
        
        tips = []
        actions = []
        
        # Dashboard tips
        if current_page in ["dashboard", "home"]:
            if not user.get("mining_active"):
                tips.append({
                    "icon": "🎯",
                    "text": "Start your reward session to earn PRC!",
                    "priority": "high"
                })
                actions.append({
                    "label": "Start Session",
                    "route": "/daily-rewards",
                    "type": "primary"
                })
            
            prc_balance = user.get("prc_balance", 0)
            if prc_balance >= 500 and user.get("membership_type") == "vip":
                tips.append({
                    "icon": "🎁",
                    "text": f"You have {prc_balance:.0f} PRC! Redeem for rewards.",
                    "priority": "medium"
                })
                actions.append({
                    "label": "View Rewards",
                    "route": "/marketplace",
                    "type": "secondary"
                })
        
        # Referrals page tips
        elif current_page == "referrals":
            referral_count = user.get("referral_count", 0)
            if referral_count < 5:
                tips.append({
                    "icon": "👥",
                    "text": f"Invite {5 - referral_count} more friends to unlock Level 2 bonuses!",
                    "priority": "high"
                })
                actions.append({
                    "label": "Share Referral Code",
                    "action": "share_referral",
                    "type": "primary"
                })
        
        # VIP page tips
        elif current_page == "vip":
            if user.get("membership_type", "free") == "free":
                tips.append({
                    "icon": "👑",
                    "text": "Subscribe to unlock shopping, bill payments & exclusive rewards!",
                    "priority": "high"
                })
        
        # KYC tips
        elif current_page == "kyc":
            kyc_status = user.get("kyc_status", "pending")
            if kyc_status == "pending":
                tips.append({
                    "icon": "📋",
                    "text": "Complete KYC to unlock full platform features!",
                    "priority": "high"
                })
            elif kyc_status == "rejected":
                tips.append({
                    "icon": "⚠️",
                    "text": "Your KYC was rejected. Please resubmit with clear documents.",
                    "priority": "urgent"
                })
        
        # Mining/Daily rewards tips
        elif current_page in ["mining", "daily-rewards"]:
            if user.get("mining_active"):
                tips.append({
                    "icon": "⚡",
                    "text": "Session active! Come back in 24 hours to claim rewards.",
                    "priority": "info"
                })
            referral_count = user.get("referral_count", 0)
            if referral_count > 0:
                tips.append({
                    "icon": "🚀",
                    "text": f"You earn bonus PRC from {referral_count} referrals while mining!",
                    "priority": "info"
                })
        
        return {
            "tips": tips[:3],  # Max 3 tips
            "actions": actions[:2],  # Max 2 actions
            "page": current_page
        }
        
    except Exception as e:
        logging.error(f"Proactive tips error: {e}")
        return {"tips": [], "actions": []}


# Page-specific contextual help tips
CONTEXTUAL_HELP_TIPS = {
    "daily-rewards": {
        "title": "Daily Rewards Help",
        "tips": [
            "Start a 24-hour session to collect PRC points",
            "Invite more friends for bonus points",
            "Claim your points before the session ends",
            "VIP members get lifetime points validity"
        ],
        "ai_prompt": "User is on the Daily Rewards page of a loyalty points app. They can start a session to collect PRC loyalty points. Provide 2-3 helpful tips on session management and collecting points. Keep response under 100 words, be encouraging."
    },
    "mining": {
        "title": "Daily Rewards Help",
        "tips": [
            "Start a 24-hour session to collect PRC points",
            "Invite more friends for bonus points",
            "Claim your points before the session ends",
            "VIP members get lifetime points validity"
        ],
        "ai_prompt": "User is on the Daily Rewards page of a loyalty points app. They can start a session to collect PRC loyalty points. Provide 2-3 helpful tips on session management and collecting points. Keep response under 100 words, be encouraging."
    },
    "referrals": {
        "title": "Invite Friends Help",
        "tips": [
            "Share your referral code to invite friends",
            "Earn bonus points when friends join",
            "Active friends give higher bonuses",
            "Use social sharing to reach more people"
        ],
        "ai_prompt": "User is on the Referrals page of a loyalty app. They can invite friends and earn bonus PRC points. Provide 2-3 tips on inviting friends, sharing referral codes, and earning bonus points. Keep response under 100 words."
    },
    "dashboard": {
        "title": "Dashboard Help",
        "tips": [
            "Check your PRC points balance here",
            "Quick access to all features from here",
            "Monitor your friends and rewards",
            "Start a rewards session if inactive"
        ],
        "ai_prompt": "User is on the main Dashboard of a loyalty rewards app. Provide 2-3 tips on navigating the app, checking their PRC points balance, and using key features like daily rewards, referrals, and marketplace. Keep response under 100 words."
    },
    "marketplace": {
        "title": "Marketplace Help",
        "tips": [
            "VIP membership required for purchases",
            "Use PRC points for product discounts",
            "Check cashback rates before buying",
            "Track orders in your order history"
        ],
        "ai_prompt": "User is on the Marketplace page where they can buy products using PRC loyalty points. Provide 2-3 tips on smart shopping, maximizing cashback, and understanding the VIP benefits. Keep response under 100 words."
    },
    "profile": {
        "title": "Profile Help",
        "tips": [
            "Complete KYC for full platform access",
            "Keep your contact info updated",
            "Upload clear documents for faster verification",
            "Check VIP transaction history here"
        ],
        "ai_prompt": "User is on their Profile page where they manage personal info and KYC documents. Provide 2-3 tips on completing verification, maintaining account security, and managing their profile. Keep response under 100 words."
    },
    "vip": {
        "title": "VIP Membership Help",
        "tips": [
            "VIP gives lifetime PRC points validity",
            "Access marketplace and bill payments",
            "Higher cashback on all transactions",
            "Lower minimum redemption limits"
        ],
        "ai_prompt": "User is on the VIP Membership page considering upgrading. Provide 2-3 compelling tips about VIP benefits like lifetime points validity, marketplace access, higher cashback, and lower redemption limits. Keep response under 100 words, be persuasive but honest."
    },
    "game": {
        "title": "Tap Game Help",
        "tips": [
            "Tap fast to earn more points",
            "Complete daily challenges for bonuses",
            "Compete on the leaderboard",
            "Redeem game points for PRC"
        ],
        "ai_prompt": "User is on the Tap Game page, an interactive game to earn rewards. Provide 2-3 tips on maximizing game points, strategies for high scores, and converting game points to PRC. Keep response under 100 words, be fun and engaging."
    },
    "bill-payments": {
        "title": "Bill Payments Help",
        "tips": [
            "VIP required for bill payments",
            "Pay mobile, DTH, and utility bills",
            "Earn cashback on every payment",
            "Processing takes 3-7 business days"
        ],
        "ai_prompt": "User is on the Bill Payments page where VIP members can pay utility bills. Provide 2-3 tips on using the service efficiently, understanding processing times, and earning cashback. Keep response under 100 words."
    },
    "gift-vouchers": {
        "title": "Gift Vouchers Help",
        "tips": [
            "VIP required for voucher redemption",
            "Redeem PRC for PhonePe vouchers",
            "Check minimum redemption amount",
            "Vouchers delivered to your email"
        ],
        "ai_prompt": "User is on the Gift Vouchers page for redeeming PRC points. Provide 2-3 tips on voucher redemption, minimum amounts, and delivery process. Keep response under 100 words."
    }
}

@router.get("/contextual-help/{page}")
async def get_contextual_help(page: str, use_ai: bool = False, uid: Optional[str] = None):
    """Get contextual help tips for a specific page, optionally with AI-generated suggestions"""
    
    # Normalize page name
    page_key = page.lower().replace("-", "_").replace(" ", "_")
    
    # Map route names to help keys
    route_mapping = {
        "network": "referrals",
        "referrals_ai": "referrals",
        "referral_dashboard_ai": "referrals",
        "dashboard_modern": "dashboard",
        "tap_game": "game",
        "gift_voucher": "gift-vouchers",
        "gift_vouchers": "gift-vouchers",
        "vip_membership": "vip",
        "bill_payments": "bill-payments",
        "profile_advanced": "profile"
    }
    
    page_key = route_mapping.get(page_key, page_key)
    
    # Get static tips
    help_data = CONTEXTUAL_HELP_TIPS.get(page_key)
    
    if not help_data:
        return {
            "page": page,
            "title": "Help",
            "tips": ["Explore this page to learn more!", "Need help? Use the AI chatbot."],
            "ai_response": None
        }
    
    response = {
        "page": page,
        "title": help_data["title"],
        "tips": help_data["tips"],
        "ai_response": None
    }
    
    # Generate AI response if requested
    if use_ai and EMERGENT_LLM_KEY:
        try:
            # Get user context if uid provided
            user_context = ""
            if uid:
                user = await db.users.find_one({"uid": uid}, {"_id": 0, "password_hash": 0})
                if user:
                    user_context = f"\nUser context: {user.get('membership_type', 'free').upper()} member, PRC balance: {user.get('prc_balance', 0):.2f}, KYC: {user.get('kyc_status', 'pending')}"
            
            chat = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"help_{page}_{str(uuid.uuid4())[:8]}",
                system_message="You are a helpful assistant for Paras Reward, a fintech app. Give short, friendly tips in English. Be encouraging and helpful."
            ).with_model("openai", "gpt-4o-mini")
            
            prompt = help_data["ai_prompt"] + user_context
            user_msg = UserMessage(text=prompt)
            ai_response = await chat.send_message(user_msg)
            
            response["ai_response"] = ai_response
            
        except Exception as e:
            logging.error(f"AI contextual help error: {e}")
            response["ai_response"] = None
    
    return response

@router.post("/scan-document")
async def ai_scan_document(
    uid: str,
    document_type: str,  # aadhaar, pan
    image_base64: str
):
    """AI-powered document scanning - Extract details from Aadhaar/PAN image and auto-fill profile"""
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="AI service not configured")
    
    # Validate document type
    if document_type not in ["aadhaar", "pan"]:
        raise HTTPException(status_code=400, detail="Invalid document type. Use 'aadhaar' or 'pan'")
    
    # Create extraction prompt based on document type
    if document_type == "aadhaar":
        extraction_prompt = """Analyze this Aadhaar Card image carefully and extract ALL information visible.

Extract and return in this exact JSON format:
{
    "success": true/false,
    "document_type": "aadhaar",
    "extracted_data": {
        "full_name": "Name exactly as shown on card",
        "aadhaar_number": "12-digit number (format: XXXX XXXX XXXX)",
        "date_of_birth": "DD/MM/YYYY format",
        "gender": "Male/Female/Other",
        "address": "Full address if visible",
        "father_name": "Father's name if visible",
        "vid": "Virtual ID if visible"
    },
    "confidence": 0-100,
    "is_valid_document": true/false,
    "message": "Success message in Marathi OR error description"
}

Important:
- If image is blurry or not an Aadhaar card, set success=false
- Extract EXACT text as shown on card (don't modify names)
- For Aadhaar number, include spaces (XXXX XXXX XXXX format)
- Set confidence based on image clarity and readability"""
    else:
        extraction_prompt = """Analyze this PAN Card image carefully and extract ALL information visible.

Extract and return in this exact JSON format:
{
    "success": true/false,
    "document_type": "pan",
    "extracted_data": {
        "full_name": "Name exactly as shown on card",
        "pan_number": "10-character PAN (format: ABCDE1234F)",
        "date_of_birth": "DD/MM/YYYY format",
        "father_name": "Father's name as shown",
        "signature_name": "Name in signature area if different"
    },
    "confidence": 0-100,
    "is_valid_document": true/false,
    "message": "Success message in Marathi OR error description"
}

Important:
- If image is blurry or not a PAN card, set success=false
- Extract EXACT text as shown on card
- PAN format: 5 letters + 4 digits + 1 letter (e.g., ABCDE1234F)
- Set confidence based on image clarity"""

    try:
        # Create chat instance for document scanning
        scan_chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"scan_{uid}_{document_type}_{str(uuid.uuid4())[:8]}",
            system_message="You are an expert document scanner. Extract information accurately from Indian identity documents (Aadhaar, PAN). Always respond in valid JSON format only."
        ).with_model("gemini", "gemini-2.5-flash")
        
        # Create message with image
        image_content = ImageContent(image_base64=image_base64)
        user_msg = UserMessage(
            text=extraction_prompt,
            file_contents=[image_content]
        )
        
        # Get AI response
        response = await scan_chat.send_message(user_msg)
        
        # Parse JSON response
        import json
        try:
            # Extract JSON from response
            json_start = response.find('{')
            json_end = response.rfind('}') + 1
            if json_start != -1 and json_end > json_start:
                result = json.loads(response[json_start:json_end])
            else:
                result = {
                    "success": False,
                    "message": "AI response parsing failed",
                    "confidence": 0
                }
        except json.JSONDecodeError:
            result = {
                "success": False,
                "message": "AI response parsing failed - invalid JSON",
                "confidence": 0
            }
        
        # Log scan attempt
        scan_log = {
            "uid": uid,
            "document_type": document_type,
            "scan_result": result,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await db.document_scans.insert_one(scan_log)
        
        # If successful and user wants auto-update, update profile
        if result.get("success") and result.get("confidence", 0) >= 70:
            extracted = result.get("extracted_data", {})
            update_data = {}
            
            if extracted.get("full_name"):
                update_data["name"] = extracted["full_name"]
            if extracted.get("date_of_birth"):
                update_data["dob"] = extracted["date_of_birth"]
            if extracted.get("gender"):
                update_data["gender"] = extracted["gender"]
            if extracted.get("address"):
                update_data["address"] = extracted["address"]
            
            if document_type == "aadhaar":
                if extracted.get("aadhaar_number"):
                    # Store only last 4 digits for security
                    aadhaar = extracted["aadhaar_number"].replace(" ", "")
                    update_data["aadhaar_last4"] = aadhaar[-4:] if len(aadhaar) >= 4 else aadhaar
                    update_data["aadhaar_masked"] = f"XXXX XXXX {aadhaar[-4:]}" if len(aadhaar) >= 4 else aadhaar
            else:
                if extracted.get("pan_number"):
                    update_data["pan_number"] = extracted["pan_number"]
                if extracted.get("father_name"):
                    update_data["father_name"] = extracted["father_name"]
            
            # Add scan metadata
            update_data[f"{document_type}_scanned"] = True
            update_data[f"{document_type}_scan_confidence"] = result.get("confidence", 0)
            update_data[f"{document_type}_scanned_at"] = datetime.now(timezone.utc).isoformat()
            
            result["profile_updates"] = update_data
        
        return {
            "document_type": document_type,
            "scan_result": result
        }
        
    except Exception as e:
        logging.error(f"Document scan error: {e}")
        return {
            "document_type": document_type,
            "scan_result": {
                "success": False,
                "message": f"Scan failed: {str(e)}",
                "confidence": 0
            }
        }

@router.post("/scan-and-update-profile")
async def ai_scan_and_update_profile(
    uid: str,
    document_type: str,
    image_base64: str,
    auto_update: bool = True
):
    """Scan document and automatically update user profile with extracted data"""
    # First scan the document
    scan_result = await ai_scan_document(uid, document_type, image_base64)
    
    result = scan_result.get("scan_result", {})
    
    if not result.get("success") or result.get("confidence", 0) < 70:
        return {
            "success": False,
            "message": result.get("message", "Document scan failed"),
            "scan_result": result
        }
    
    # If auto_update is enabled, update the profile
    if auto_update and result.get("profile_updates"):
        updates = result["profile_updates"]
        
        await db.users.update_one(
            {"uid": uid},
            {"$set": updates}
        )
        
        # Get updated user profile
        updated_user = await db.users.find_one({"uid": uid}, {"_id": 0, "password_hash": 0})
        
        return {
            "success": True,
            "message": f"✅ {document_type.upper()} scanned successfully! Profile updated.",
            "extracted_data": result.get("extracted_data", {}),
            "profile_updates": updates,
            "updated_profile": updated_user,
            "confidence": result.get("confidence", 0)
        }
    
    return {
        "success": True,
        "message": "Document scanned successfully",
        "extracted_data": result.get("extracted_data", {}),
        "profile_updates": result.get("profile_updates", {}),
        "confidence": result.get("confidence", 0),
        "auto_updated": False
    }

# ========== ADMIN SECURITY ENDPOINTS ==========

async def refresh_access_token(refresh_token: str):
    """Refresh access token using refresh token"""
    payload = verify_token(refresh_token, token_type="refresh")
    
    uid = payload.get("uid")
    user = await db.users.find_one({"uid": uid}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    # Create new access token
    token_id = str(uuid.uuid4())
    token_data = {
        "uid": user["uid"],
        "email": user.get("email"),
        "role": user.get("role"),
        "token_id": token_id
    }
    new_access_token = create_access_token(token_data)
    
    # Update session
    if user.get("role") in ["admin", "sub_admin"]:
        await db.admin_sessions.update_one(
            {"uid": uid, "is_active": True},
            {"$set": {
                "token_id": token_id,
                "last_activity": datetime.now(timezone.utc).isoformat(),
                "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES)).isoformat()
            }}
        )
    
    return {
        "access_token": new_access_token,
        "token_type": "bearer",
        "expires_in": JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60
    }

async def logout_all_sessions(uid: str, admin_uid: str):
    """Logout from all sessions (admin only)"""
    admin = await db.users.find_one({"uid": admin_uid})
    if not admin or admin.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.admin_sessions.update_many(
        {"uid": uid, "is_active": True},
        {"$set": {"is_active": False, "logged_out_at": datetime.now(timezone.utc).isoformat(), "logout_reason": "admin_forced"}}
    )
    
    await log_admin_action(
        admin_uid=admin_uid,
        action="force_logout_all",
        entity_type="security",
        entity_id=uid,
        details={"sessions_terminated": result.modified_count}
    )
    
    return {"message": f"Logged out {result.modified_count} sessions"}

async def get_user_sessions(uid: str, admin_uid: str):
    """Get all active sessions for a user"""
    admin = await db.users.find_one({"uid": admin_uid})
    if not admin or admin.get("role") not in ["admin", "sub_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    sessions = await db.admin_sessions.find(
        {"uid": uid},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return {
        "uid": uid,
        "sessions": sessions,
        "active_count": len([s for s in sessions if s.get("is_active")])
    }

async def get_admin_audit_logs(
    admin_uid: str,
    page: int = 1,
    limit: int = 50,
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Get admin audit logs with filtering"""
    admin = await db.users.find_one({"uid": admin_uid})
    if not admin or admin.get("role") not in ["admin", "sub_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {}
    if action:
        query["action"] = action
    if entity_type:
        query["entity_type"] = entity_type
    if start_date:
        query["timestamp"] = {"$gte": start_date}
    if end_date:
        if "timestamp" in query:
            query["timestamp"]["$lte"] = end_date
        else:
            query["timestamp"] = {"$lte": end_date}
    
    skip = (page - 1) * limit
    total = await db.admin_audit_logs.count_documents(query)
    logs = await db.admin_audit_logs.find(query, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "logs": logs,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }

async def get_ip_whitelist(admin_uid: str):
    """Get IP whitelist settings"""
    admin = await db.users.find_one({"uid": admin_uid})
    if not admin or admin.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    settings = await db.admin_security_settings.find_one({"setting_type": "ip_whitelist"}, {"_id": 0})
    return settings or {
        "setting_type": "ip_whitelist",
        "enabled": False,
        "whitelist": [],
        "updated_at": None
    }

async def update_ip_whitelist(
    admin_uid: str,
    enabled: bool,
    whitelist: List[str] = Query(default=[])
):
    """Update IP whitelist settings"""
    admin = await db.users.find_one({"uid": admin_uid})
    if not admin or admin.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Validate IPs
    import ipaddress
    valid_ips = []
    for ip in whitelist:
        try:
            if "/" in ip:
                ipaddress.ip_network(ip, strict=False)
            else:
                ipaddress.ip_address(ip)
            valid_ips.append(ip)
        except ValueError:
            pass  # Skip invalid IPs
    
    settings_data = {
        "setting_type": "ip_whitelist",
        "enabled": enabled,
        "whitelist": valid_ips,
        "updated_by": admin_uid,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.admin_security_settings.update_one(
        {"setting_type": "ip_whitelist"},
        {"$set": settings_data},
        upsert=True
    )
    
    await log_admin_action(
        admin_uid=admin_uid,
        action="update_ip_whitelist",
        entity_type="security",
        details={"enabled": enabled, "ip_count": len(valid_ips)}
    )
    
    return {"message": "IP whitelist updated", "valid_ips": len(valid_ips)}

async def get_lockdown_status_api(admin_uid: str):
    """Get current system lockdown status"""
    admin = await db.users.find_one({"uid": admin_uid})
    if not admin or admin.get("role") not in ["admin", "sub_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    status = await get_lockdown_status()
    return status

async def deactivate_lockdown(request: Request, admin_uid: str):
    """Deactivate system lockdown"""
    admin = await db.users.find_one({"uid": admin_uid})
    if not admin or admin.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only main admin can deactivate lockdown")
    
    # Get current lockdown info before deactivating
    current = await get_lockdown_status()
    
    await db.admin_security_settings.update_one(
        {"setting_type": "lockdown"},
        {"$set": {
            "lockdown_active": False,
            "deactivated_by": admin_uid,
            "deactivated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    real_ip = request.client.host if request.client else "unknown"
    await log_admin_action(
        admin_uid=admin_uid,
        action="deactivate_lockdown",
        entity_type="security",
        details={"previous_type": current.get("lockdown_type"), "duration_hours": None},
        ip_address=real_ip,
        user_agent=request.headers.get("user-agent", "unknown")
    )
    
    return {"message": "System lockdown deactivated"}

async def get_security_dashboard(admin_uid: str):
    """Get comprehensive security dashboard"""
    admin = await db.users.find_one({"uid": admin_uid})
    if not admin or admin.get("role") not in ["admin", "sub_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    
    # Active sessions
    active_sessions = await db.admin_sessions.count_documents({"is_active": True})
    
    # Today's logins
    today_logins = await db.admin_audit_logs.count_documents({
        "action": "login",
        "timestamp": {"$gte": today_start}
    })
    
    # Failed login attempts (from rate limit storage - approximate)
    failed_attempts_today = sum(1 for k, v in login_attempt_storage.items() if v.get("count", 0) > 0)
    
    # Recent suspicious activities
    suspicious_activities = await db.admin_audit_logs.find({
        "action": {"$in": ["login_blocked_ip", "force_logout_all", "activate_lockdown"]}
    }, {"_id": 0}).sort("timestamp", -1).limit(10).to_list(10)
    
    # Lockdown status
    lockdown = await get_lockdown_status()
    
    # IP whitelist status
    ip_whitelist = await db.admin_security_settings.find_one({"setting_type": "ip_whitelist"}, {"_id": 0})
    
    return {
        "active_admin_sessions": active_sessions,
        "today_admin_logins": today_logins,
        "failed_login_attempts_active": failed_attempts_today,
        "lockdown_status": lockdown,
        "ip_whitelist_enabled": ip_whitelist.get("enabled", False) if ip_whitelist else False,
        "ip_whitelist_count": len(ip_whitelist.get("whitelist", [])) if ip_whitelist else 0,
        "recent_security_events": suspicious_activities,
        "session_timeout_minutes": SESSION_TIMEOUT_MINUTES,
        "rate_limit_login_attempts": RATE_LIMIT_LOGIN_ATTEMPTS,
        "jwt_token_expiry_minutes": JWT_ACCESS_TOKEN_EXPIRE_MINUTES
    }
