import Link from 'next/link'
import BackHomeNav from '@/components/BackHomeNav'

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <BackHomeNav />
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-[#a1a1aa] text-sm">
            Last updated: August 17, 2026
          </p>
        </div>

        <div className="prose prose-invert prose-sm max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-4">1. Introduction</h2>
            <p className="text-[#d4d4d8] leading-relaxed">
              GoldenPegasus IT Consulting & Services LLC (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) respects your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform and services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">2. Information We Collect</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium mb-2">Personal Information</h3>
                <p className="text-[#d4d4d8] leading-relaxed">
                  We may collect personally identifiable information that you voluntarily provide to us when you register for an account, including but not limited to:
                </p>
                <ul className="list-disc list-inside text-[#d4d4d8] mt-2 space-y-1">
                  <li>Name and contact information</li>
                  <li>Email address</li>
                  <li>Phone number</li>
                  <li>Company or organization details</li>
                  <li>Job title and role</li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-lg font-medium mb-2">Usage Data</h3>
                <p className="text-[#d4d4d8] leading-relaxed">
                  We automatically collect certain information when you access or use our platform, including:
                </p>
                <ul className="list-disc list-inside text-[#d4d4d8] mt-2 space-y-1">
                  <li>Log data (IP address, browser type, pages visited)</li>
                  <li>Device information</li>
                  <li>Usage patterns and preferences</li>
                  <li>Timestamps of interactions</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">3. How We Use Your Information</h2>
            <p className="text-[#d4d4d8] leading-relaxed">
              We use the information we collect for various purposes, including:
            </p>
            <ul className="list-disc list-inside text-[#d4d4d8] mt-2 space-y-1">
              <li>Providing and maintaining our services</li>
              <li>Processing transactions and managing your account</li>
              <li>Communicating with you about updates, offers, and support</li>
              <li>Improving and personalizing your experience</li>
              <li>Ensuring security and preventing fraud</li>
              <li>Complying with legal obligations</li>
              <li>Generating aggregated, non-identifying analytics</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">4. Information Sharing and Disclosure</h2>
            <p className="text-[#d4d4d8] leading-relaxed">
              We do not sell your personal information. We may share your information only in the following circumstances:
            </p>
            <ul className="list-disc list-inside text-[#d4d4d8] mt-2 space-y-1">
              <li>With your explicit consent</li>
              <li>To comply with legal obligations or respond to lawful requests</li>
              <li>To protect our rights, privacy, safety, or property</li>
              <li>In connection with a merger, acquisition, or sale of assets</li>
              <li>With trusted service providers who assist in operating our platform (under strict confidentiality obligations)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">5. Data Security</h2>
            <p className="text-[#d4d4d8] leading-relaxed">
              We implement industry-standard security measures to protect your personal information, including encryption, access controls, and regular security audits. However, no method of transmission over the Internet or electronic storage is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">6. Data Retention</h2>
            <p className="text-[#d4d4d8] leading-relaxed">
              We retain your personal information only for as long as necessary to fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required or permitted by law. When we no longer need your information, we will securely delete or anonymize it.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">7. Your Rights</h2>
            <p className="text-[#d4d4d8] leading-relaxed">
              Depending on your location, you may have the following rights regarding your personal information:
            </p>
            <ul className="list-disc list-inside text-[#d4d4d8] mt-2 space-y-1">
              <li>Access and receive a copy of your personal data</li>
              <li>Correct inaccurate or incomplete data</li>
              <li>Request deletion of your personal data</li>
              <li>Object to or restrict the processing of your data</li>
              <li>Data portability</li>
              <li>Withdraw consent at any time</li>
            </ul>
            <p className="text-[#d4d4d8] leading-relaxed mt-4">
              To exercise any of these rights, please contact us using the information provided below.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">8. Cookies and Tracking Technologies</h2>
            <p className="text-[#d4d4d8] leading-relaxed">
              We use cookies and similar tracking technologies to enhance your experience on our platform. You can control cookies through your browser settings. Disabling cookies may affect the functionality of certain features.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">9. Third-Party Services</h2>
            <p className="text-[#d4d4d8] leading-relaxed">
              Our platform may contain links to third-party websites or services. We are not responsible for the privacy practices of these third parties. We encourage you to review their privacy policies before providing any personal information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">10. Children&apos;s Privacy</h2>
            <p className="text-[#d4d4d8] leading-relaxed">
              Our services are not directed to individuals under the age of 18. We do not knowingly collect personal information from children. If we become aware that we have collected personal information from a child, we will take steps to delete it promptly.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">11. Changes to This Policy</h2>
            <p className="text-[#d4d4d8] leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the &quot;Last updated&quot; date. Your continued use of our services after any modifications indicates your acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">12. Contact Us</h2>
            <p className="text-[#d4d4d8] leading-relaxed">
              If you have any questions about this Privacy Policy, please contact us:
            </p>
            <div className="mt-4 p-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
              <p className="text-[#d4d4d8]">
                <strong>GoldenPegasus IT Consulting & Services LLC</strong><br />
                Email: privacy@goldenpegasus.com<br />
                Website: www.goldenpegasus.com
              </p>
            </div>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-[#2a2a2a]">
          <Link 
            href="/" 
            className="text-[#22c55e] hover:text-[#4ade80] text-sm transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </main>
  )
}
