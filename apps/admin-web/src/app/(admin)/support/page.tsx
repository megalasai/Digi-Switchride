export default function SupportPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Customer Support</h1>
      <p className="text-gray-500 mb-4">Support ticket management — tickets are created by customers via the mobile app.</p>
      <div className="bg-white rounded-lg shadow p-8 text-center text-gray-400">
        <p className="text-4xl mb-4">🎧</p>
        <p>Support tickets will appear here when customers submit them through the app.</p>
        <p className="text-sm mt-2">Integrate with Freshdesk or Zoho Desk for advanced ticketing.</p>
      </div>
    </div>
  );
}
