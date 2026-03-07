"""
PARAS REWARD - Models Package
"""

from .schemas import (
    # User models
    User,
    UserLogin,
    UserUpdateRequest,
    BalanceAdjustRequest,
    
    # Mining models
    MiningStatus,
    MiningCollectRequest,
    TapGamePlay,
    
    # Referral models
    ReferralInfo,
    
    # Payment models
    VIPPayment,
    VIPPaymentCreate,
    VIPPaymentAction,
    
    # KYC models
    KYCDocument,
    KYCSubmit,
    
    # Product/Order models
    Product,
    ProductCreate,
    OrderSingleProduct,
    OrderCreate,
    OrderVerify,
    
    # Delivery models
    DeliveryPartner,
    DeliveryPartnerCreate,
    
    # Wallet models
    WalletWithdrawal,
    
    # Notification models
    Notification,
    NotificationCreate,
    
    # Activity models
    ActivityLog,
    
    # Bill Payment models
    BillPaymentRequest,
    BillPaymentRequestCreate,
    BillPaymentProcess,
    GiftVoucherRequest,
    GiftVoucherRequestCreate,
    GiftVoucherProcess,
    
    # Auth models
    ForgotPinRequest,
    VerifyOTPRequest,
    ResetPinRequest,
    PasswordRecoveryVerifyRequest,
    PasswordRecoveryResetRequest,
    
    # Support models
    SupportTicket,
    SupportTicketReply,
    TicketCreateRequest,
    TicketReplyRequest,
    TicketUpdateRequest,
    
    # Leaderboard models
    LeaderboardEntry,
    
    # Social models
    FollowRequest,
    MessageRequest,
    ConversationMessage,
    
    # Settings models
    SocialMediaSettings,
    ContactSubmission,
)

__all__ = [
    'User', 'UserLogin', 'UserUpdateRequest', 'BalanceAdjustRequest',
    'MiningStatus', 'MiningCollectRequest', 'TapGamePlay',
    'ReferralInfo',
    'VIPPayment', 'VIPPaymentCreate', 'VIPPaymentAction',
    'KYCDocument', 'KYCSubmit',
    'Product', 'ProductCreate', 'OrderSingleProduct', 'OrderCreate', 'OrderVerify',
    'DeliveryPartner', 'DeliveryPartnerCreate',
    'WalletWithdrawal',
    'Notification', 'NotificationCreate',
    'ActivityLog',
    'BillPaymentRequest', 'BillPaymentRequestCreate', 'BillPaymentProcess',
    'GiftVoucherRequest', 'GiftVoucherRequestCreate', 'GiftVoucherProcess',
    'ForgotPinRequest', 'VerifyOTPRequest', 'ResetPinRequest',
    'PasswordRecoveryVerifyRequest', 'PasswordRecoveryResetRequest',
    'SupportTicket', 'SupportTicketReply', 'TicketCreateRequest', 'TicketReplyRequest', 'TicketUpdateRequest',
    'LeaderboardEntry',
    'FollowRequest', 'MessageRequest', 'ConversationMessage',
    'SocialMediaSettings', 'ContactSubmission',
]
