from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, File, UploadFile, Form, Request, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from pathlib import Path

    print("🔒 Database connection closed")