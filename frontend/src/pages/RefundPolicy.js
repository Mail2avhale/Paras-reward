import React from 'react';
import { Link } from 'react-router-dom';
import Footer from '../components/Footer';
import AdSenseAd from '../components/AdSenseAd';

const RefundPolicy = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link to="/" className="inline-flex items-center text-purple-600 hover:text-purple-700 mb-4">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Home
          </Link>
          <h1 className="text-4xl font-bold text-gray-900">Refund & Cancellation Policy</h1>
          <p className="text-gray-600 mt-2">Last Updated: January 2025</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-lg p-8 space-y-8">
          
          {/* Introduction */}
          <section>
            <p className="text-gray-700 leading-relaxed mb-4">
              At <strong>PARAS REWARD</strong>, we are committed to ensuring your satisfaction with our services. This Refund & Cancellation Policy outlines the terms and conditions for refunds, cancellations, and returns on our platform.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Please read this policy carefully before making any purchases or transactions on our platform.
            </p>
          </section>

          <AdSenseAd slot="1234567890" format="auto" />

          {/* PRC (Reward Points) */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">1. PRC Reward Points</h2>
            
            <div className="bg-purple-50 border-l-4 border-purple-500 p-4 mb-4">
              <p className="text-purple-900 font-semibold">Non-Refundable Policy</p>
              <p className="text-purple-800 mt-2">
                PRC (PARAS Reward Coins) earned through mining, tap games, treasure hunts, or scratch cards are <strong>non-refundable and non-transferable</strong>.
              </p>
            </div>

            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
              <li><strong>Earned PRC:</strong> Points earned through platform activities (mining, games) cannot be refunded or exchanged for cash.</li>
              <li><strong>Expiry Policy:</strong> Free users' PRC may expire as per platform terms. VIP users' PRC does not expire.</li>
              <li><strong>No Cash Value:</strong> PRC points have no monetary value outside the PARAS REWARD platform and can only be redeemed for products/services listed in our marketplace.</li>
              <li><strong>Account Termination:</strong> If your account is terminated due to violation of terms, all accumulated PRC will be forfeited without refund.</li>
            </ul>
          </section>

          {/* VIP Membership */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">2. VIP Membership Fees</h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">2.1 Non-Refundable Policy</h3>
                <p className="text-gray-700 leading-relaxed">
                  VIP membership fees paid to access premium features are <strong>strictly non-refundable</strong> under any circumstances, including but not limited to:
                </p>
                <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4 mt-2">
                  <li>Change of mind after purchase</li>
                  <li>Inability to use the service due to personal reasons</li>
                  <li>Dissatisfaction with features (unless service was not provided as described)</li>
                  <li>Technical issues on user's end (device compatibility, internet connectivity)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">2.2 Cancellation Policy</h3>
                <p className="text-gray-700 leading-relaxed">
                  Users can cancel their VIP membership at any time, but:
                </p>
                <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4 mt-2">
                  <li>No refund will be provided for the remaining subscription period</li>
                  <li>Access to VIP features will continue until the end of the current billing cycle</li>
                  <li>Auto-renewal can be disabled from account settings</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">2.3 Exception Cases</h3>
                <p className="text-gray-700 leading-relaxed">
                  Refunds may be considered <strong>only</strong> in the following exceptional cases:
                </p>
                <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4 mt-2">
                  <li><strong>Duplicate Charges:</strong> If you were charged multiple times for the same membership due to a technical error</li>
                  <li><strong>Service Failure:</strong> If VIP features were not activated within 48 hours of payment confirmation despite proper payment</li>
                  <li><strong>Unauthorized Charges:</strong> If the charge was made without your consent (subject to verification)</li>
                </ul>
                <p className="text-gray-700 leading-relaxed mt-2">
                  Refund requests for exceptional cases must be submitted within <strong>7 days</strong> of the transaction date.
                </p>
              </div>
            </div>
          </section>

          <AdSenseAd slot="9876543210" format="auto" />

          {/* Marketplace Products */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Marketplace Product Orders</h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">3.1 Order Cancellation</h3>
                <p className="text-gray-700 leading-relaxed mb-2">
                  <strong>Before Delivery:</strong>
                </p>
                <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                  <li>Orders can be cancelled within <strong>24 hours</strong> of order placement if the order status is "Pending" or "Processing"</li>
                  <li>Once order status changes to "Shipped" or "Out for Delivery", cancellation is not possible</li>
                  <li>PRC points used for the order will be refunded to your account within 2-3 business days</li>
                  <li>Delivery charges paid (if any) will be refunded based on payment method</li>
                </ul>

                <p className="text-gray-700 leading-relaxed mt-4 mb-2">
                  <strong>After Delivery:</strong>
                </p>
                <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                  <li>Orders cannot be cancelled after successful delivery and verification</li>
                  <li>For product issues, please refer to our Return & Replacement Policy (Section 3.2)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">3.2 Return & Replacement Policy</h3>
                <p className="text-gray-700 leading-relaxed mb-2">
                  We accept returns and offer replacements in the following cases:
                </p>
                <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                  <li><strong>Damaged Products:</strong> If the product arrives damaged or defective</li>
                  <li><strong>Wrong Product:</strong> If you receive a different product than what was ordered</li>
                  <li><strong>Missing Items:</strong> If items are missing from your order</li>
                  <li><strong>Quality Issues:</strong> If the product does not match the description on our platform</li>
                </ul>

                <p className="text-gray-700 leading-relaxed mt-4 mb-2">
                  <strong>Return Conditions:</strong>
                </p>
                <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                  <li>Return request must be raised within <strong>7 days</strong> of delivery</li>
                  <li>Product must be unused, in original packaging with all tags and accessories intact</li>
                  <li>Photographic evidence of damage/defect must be provided</li>
                  <li>Certain categories like consumables, personal care, and food items are non-returnable unless defective</li>
                </ul>

                <p className="text-gray-700 leading-relaxed mt-4 mb-2">
                  <strong>Return Process:</strong>
                </p>
                <ol className="list-decimal list-inside space-y-2 text-gray-700 ml-4">
                  <li>Submit a return request through your Order History section</li>
                  <li>Provide required details and upload photos (if applicable)</li>
                  <li>Wait for admin approval (typically within 2-3 business days)</li>
                  <li>Once approved, arrange pickup or ship the product back to us</li>
                  <li>Upon receipt and inspection, we will process replacement or refund</li>
                </ol>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">3.3 Refund Method for Product Orders</h3>
                <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                  <li><strong>PRC Points:</strong> Refunded to your PRC wallet within 2-3 business days</li>
                  <li><strong>Cashback Wallet:</strong> If cashback was earned on the order, it will be reversed</li>
                  <li><strong>Delivery Charges:</strong> Refunded to your cashback wallet or original payment method (if paid separately)</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Cashback & Wallet Withdrawals */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Cashback & Wallet Withdrawals</h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">4.1 Withdrawal Requests</h3>
                <p className="text-gray-700 leading-relaxed">
                  Once a withdrawal request is submitted and approved by admin, it <strong>cannot be cancelled or reversed</strong>.
                </p>
                <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4 mt-2">
                  <li>Minimum withdrawal amount: ₹10 for cashback wallet, ₹50 for profit wallet</li>
                  <li>Withdrawal fees apply as per platform terms</li>
                  <li>Processing time: 3-7 business days after admin approval</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">4.2 Rejected Withdrawals</h3>
                <p className="text-gray-700 leading-relaxed">
                  If a withdrawal request is rejected by admin, the requested amount will be refunded to your wallet automatically.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">4.3 Failed Bank Transfers</h3>
                <p className="text-gray-700 leading-relaxed">
                  If a bank transfer fails due to incorrect account details provided by you:
                </p>
                <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4 mt-2">
                  <li>The amount will be credited back to your wallet within 7-10 business days</li>
                  <li>You can submit a new withdrawal request with correct details</li>
                  <li>PARAS REWARD is not responsible for delays caused by incorrect information</li>
                </ul>
              </div>
            </div>
          </section>

          <AdSenseAd slot="1122334455" format="auto" />

          {/* Stockist Services */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Stockist Services (Master/Sub/Outlet)</h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">5.1 Security Deposits</h3>
                <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                  <li>Security deposits are <strong>refundable</strong> upon termination of stockist agreement</li>
                  <li>Refund will be processed after deduction of any pending dues, penalties, or outstanding amounts</li>
                  <li>Monthly returns (3% of deposit) are credited to profit wallet and are non-refundable once credited</li>
                  <li>Refund processing time: 15-30 business days after agreement termination</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">5.2 Annual Renewal Fees</h3>
                <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                  <li>Annual renewal fees are <strong>non-refundable</strong> once paid</li>
                  <li>If renewal is not paid on time, account may be suspended</li>
                  <li>No refund for unused portion of renewal period</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">5.3 Commission & Profit Wallet</h3>
                <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                  <li>Commissions earned from delivery charges are non-refundable</li>
                  <li>Once credited to profit wallet, amounts cannot be reversed</li>
                  <li>Withdrawal processing follows standard wallet withdrawal policy</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Refund Processing */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Refund Processing Time</h2>
            
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-300 rounded-lg">
                <thead className="bg-purple-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 border-b">Refund Type</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 border-b">Processing Time</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 border-b">Refund Method</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="px-6 py-4 text-sm text-gray-700">PRC Points (Order Cancellation)</td>
                    <td className="px-6 py-4 text-sm text-gray-700">2-3 business days</td>
                    <td className="px-6 py-4 text-sm text-gray-700">PRC Wallet</td>
                  </tr>
                  <tr className="border-b bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-700">Product Return</td>
                    <td className="px-6 py-4 text-sm text-gray-700">5-7 business days after inspection</td>
                    <td className="px-6 py-4 text-sm text-gray-700">PRC Wallet / Original Method</td>
                  </tr>
                  <tr className="border-b">
                    <td className="px-6 py-4 text-sm text-gray-700">Rejected Withdrawal</td>
                    <td className="px-6 py-4 text-sm text-gray-700">Immediate</td>
                    <td className="px-6 py-4 text-sm text-gray-700">Cashback/Profit Wallet</td>
                  </tr>
                  <tr className="border-b bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-700">Failed Bank Transfer</td>
                    <td className="px-6 py-4 text-sm text-gray-700">7-10 business days</td>
                    <td className="px-6 py-4 text-sm text-gray-700">Cashback/Profit Wallet</td>
                  </tr>
                  <tr className="border-b">
                    <td className="px-6 py-4 text-sm text-gray-700">Security Deposit (Stockist)</td>
                    <td className="px-6 py-4 text-sm text-gray-700">15-30 business days</td>
                    <td className="px-6 py-4 text-sm text-gray-700">Bank Transfer</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-700">Duplicate Charge (VIP)</td>
                    <td className="px-6 py-4 text-sm text-gray-700">7-14 business days</td>
                    <td className="px-6 py-4 text-sm text-gray-700">Original Payment Method</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-gray-600 text-sm mt-4 italic">
              * Processing times are approximate and may vary based on verification requirements and banking processes.
            </p>
          </section>

          {/* How to Request Refund */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">7. How to Request a Refund</h2>
            
            <ol className="list-decimal list-inside space-y-3 text-gray-700 ml-4">
              <li>
                <strong>Order Cancellation:</strong>
                <ul className="list-disc list-inside space-y-1 text-gray-600 ml-6 mt-1">
                  <li>Go to "My Orders" section in your dashboard</li>
                  <li>Select the order you want to cancel</li>
                  <li>Click "Cancel Order" button (available only if order is pending/processing)</li>
                </ul>
              </li>
              <li>
                <strong>Product Return:</strong>
                <ul className="list-disc list-inside space-y-1 text-gray-600 ml-6 mt-1">
                  <li>Go to "My Orders" section</li>
                  <li>Select the delivered order</li>
                  <li>Click "Return/Replace" button</li>
                  <li>Fill the return form with reason and upload photos</li>
                  <li>Wait for admin approval</li>
                </ul>
              </li>
              <li>
                <strong>VIP Membership Issues:</strong>
                <ul className="list-disc list-inside space-y-1 text-gray-600 ml-6 mt-1">
                  <li>Go to "Support Tickets" section</li>
                  <li>Create a new ticket with category "VIP/Membership"</li>
                  <li>Provide transaction details and describe the issue</li>
                  <li>Attach payment proof if required</li>
                </ul>
              </li>
              <li>
                <strong>Other Refund Requests:</strong>
                <ul className="list-disc list-inside space-y-1 text-gray-600 ml-6 mt-1">
                  <li>Contact our support team via Support Tickets</li>
                  <li>Provide all relevant details (transaction ID, date, amount, reason)</li>
                  <li>Our team will review and respond within 2-3 business days</li>
                </ul>
              </li>
            </ol>
          </section>

          <AdSenseAd slot="5544332211" format="auto" />

          {/* Important Notes */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Important Notes</h2>
            
            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-4">
              <p className="text-yellow-900 font-semibold mb-2">Please Note:</p>
              <ul className="list-disc list-inside space-y-2 text-yellow-800 ml-4">
                <li>All refund requests are subject to verification and admin approval</li>
                <li>PARAS REWARD reserves the right to reject refund requests that violate terms of service</li>
                <li>Abuse of refund policy (multiple false claims) may result in account suspension</li>
                <li>Refunds are processed in the currency of the original transaction</li>
                <li>Bank processing fees (if any) are not refundable</li>
              </ul>
            </div>

            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
              <li><strong>Proof of Purchase:</strong> Always keep transaction receipts and order confirmations for reference</li>
              <li><strong>Communication:</strong> Check your registered email and app notifications for refund status updates</li>
              <li><strong>Disputes:</strong> If you disagree with a refund decision, you can escalate through support tickets</li>
              <li><strong>Force Majeure:</strong> Refunds may be delayed in case of circumstances beyond our control (natural disasters, system failures, etc.)</li>
            </ul>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">9. Contact Us</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              If you have any questions about our Refund & Cancellation Policy, please contact us:
            </p>
            <div className="bg-purple-50 rounded-lg p-6 space-y-2">
              <p className="text-gray-700">
                <strong>Email:</strong> <a href="mailto:support@parasreward.com" className="text-purple-600 hover:underline">support@parasreward.com</a>
              </p>
              <p className="text-gray-700">
                <strong>Support Tickets:</strong> Create a ticket through your dashboard
              </p>
              <p className="text-gray-700">
                <strong>Business Hours:</strong> Monday - Saturday, 9:00 AM - 6:00 PM IST
              </p>
            </div>
          </section>

          {/* Policy Changes */}
          <section className="border-t pt-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Policy Changes</h2>
            <p className="text-gray-700 leading-relaxed">
              PARAS REWARD reserves the right to modify this Refund & Cancellation Policy at any time. Changes will be effective immediately upon posting to the platform. Your continued use of the platform after any changes constitutes acceptance of the new policy.
            </p>
            <p className="text-gray-700 leading-relaxed mt-2">
              We recommend reviewing this policy periodically to stay informed about how we handle refunds and cancellations.
            </p>
          </section>

          {/* Footer Links */}
          <div className="border-t pt-6 flex flex-wrap gap-4 justify-center text-sm">
            <Link to="/terms" className="text-purple-600 hover:underline">Terms & Conditions</Link>
            <span className="text-gray-400">|</span>
            <Link to="/privacy" className="text-purple-600 hover:underline">Privacy Policy</Link>
            <span className="text-gray-400">|</span>
            <Link to="/contact" className="text-purple-600 hover:underline">Contact Us</Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default RefundPolicy;
