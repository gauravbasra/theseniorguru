import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | TheSeniorGuru",
  description: "How TheSeniorGuru collects, uses, and protects your personal information.",
  alternates: { canonical: "/privacy" }
};

export default function PrivacyPage() {
  return (
    <main className="site-shell">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="TheSeniorGuru home">
          <span>SG</span>
          <strong>TheSeniorGuru</strong>
        </Link>
        <nav aria-label="Site navigation">
          <Link href="/">Home</Link>
          <Link href="/terms">Terms of Service</Link>
        </nav>
      </header>

      <div className="legal-page">
        <div className="legal-header">
          <span>Legal</span>
          <h1>Privacy Policy</h1>
          <p>Last updated: June 8, 2025</p>
        </div>

        <div className="legal-body">
          <section>
            <h2>1. Introduction</h2>
            <p>
              TheSeniorGuru (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) operates the website
              theseniorguru.com and the TheSeniorGuru mobile application (collectively, the &ldquo;Platform&rdquo;).
              This Privacy Policy explains how we collect, use, disclose, and protect information about you when you use
              our Platform. Please read this policy carefully. By using the Platform you agree to the practices
              described here.
            </p>
          </section>

          <section>
            <h2>2. Information We Collect</h2>
            <h3>Information you provide directly</h3>
            <ul>
              <li>Name, email address, phone number, and account credentials when you register</li>
              <li>Profile information such as age, health preferences, and care needs</li>
              <li>Payment and billing information when you purchase services</li>
              <li>Messages, requests, and communications you send through the Platform</li>
              <li>Feedback, survey responses, and support communications</li>
            </ul>
            <h3>Information collected automatically</h3>
            <ul>
              <li>Device identifiers, IP address, browser type, and operating system</li>
              <li>Usage data such as pages viewed, features used, and time spent</li>
              <li>Location data when you enable location services (used to match local providers)</li>
              <li>Cookies and similar tracking technologies (see Section 8)</li>
            </ul>
            <h3>Information from third parties</h3>
            <ul>
              <li>Service provider partners (such as Thumbtack) who refer users or provide integration services</li>
              <li>Analytics and advertising partners</li>
              <li>Public databases used to verify provider credentials</li>
            </ul>
          </section>

          <section>
            <h2>3. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul>
              <li>Create and manage your account and provide Platform features</li>
              <li>Match seniors and families with appropriate local service providers</li>
              <li>Process transactions and send related communications</li>
              <li>Send service notifications, reminders, and emergency alerts</li>
              <li>Improve, personalize, and develop the Platform</li>
              <li>Monitor safety and detect fraudulent or harmful activity</li>
              <li>Comply with legal obligations</li>
              <li>Communicate about updates, offers, and promotions (you may opt out at any time)</li>
            </ul>
          </section>

          <section>
            <h2>4. How We Share Your Information</h2>
            <p>We do not sell your personal information. We may share it in the following circumstances:</p>
            <ul>
              <li>
                <strong>Service providers:</strong> With vendors who help us operate the Platform (hosting, payment
                processing, analytics, customer support) under confidentiality obligations.
              </li>
              <li>
                <strong>Partner providers:</strong> When you request or are matched with a service provider, we share
                the information necessary to fulfill that request.
              </li>
              <li>
                <strong>Integration partners:</strong> With platforms such as Thumbtack when you engage with
                integrations, subject to their own privacy policies.
              </li>
              <li>
                <strong>Legal requirements:</strong> When required by law, court order, or to protect the rights, safety,
                or property of TheSeniorGuru, our users, or the public.
              </li>
              <li>
                <strong>Business transfers:</strong> In connection with a merger, acquisition, or sale of assets, with
                notice to you.
              </li>
              <li>
                <strong>With your consent:</strong> For any other purpose disclosed to you when you provide the
                information.
              </li>
            </ul>
          </section>

          <section>
            <h2>5. Data Retention</h2>
            <p>
              We retain personal information for as long as your account is active or as needed to provide services. We
              may retain certain data for longer periods to comply with legal obligations, resolve disputes, or enforce
              our agreements. You may request deletion of your account and associated data by contacting us at{" "}
              <a href="mailto:privacy@theseniorguru.com">privacy@theseniorguru.com</a>.
            </p>
          </section>

          <section>
            <h2>6. Your Rights and Choices</h2>
            <p>Depending on your location, you may have the right to:</p>
            <ul>
              <li>Access, correct, or delete your personal information</li>
              <li>Object to or restrict certain processing activities</li>
              <li>Receive a portable copy of your data</li>
              <li>Opt out of marketing communications at any time</li>
              <li>Withdraw consent where processing is based on consent</li>
            </ul>
            <p>
              To exercise any of these rights, please contact us at{" "}
              <a href="mailto:privacy@theseniorguru.com">privacy@theseniorguru.com</a>. We will respond within 30 days.
            </p>
          </section>

          <section>
            <h2>7. Children&apos;s Privacy</h2>
            <p>
              The Platform is not directed to children under 13. We do not knowingly collect personal information from
              children under 13. If you believe a child has provided us personal information, please contact us and we
              will delete it promptly.
            </p>
          </section>

          <section>
            <h2>8. Cookies and Tracking</h2>
            <p>
              We use cookies and similar technologies to operate the Platform, remember preferences, analyze usage, and
              deliver relevant content. You can control cookies through your browser settings; however, disabling cookies
              may limit certain features. We do not currently respond to browser &ldquo;Do Not Track&rdquo; signals.
            </p>
          </section>

          <section>
            <h2>9. Security</h2>
            <p>
              We implement reasonable administrative, technical, and physical safeguards to protect your information.
              However, no method of transmission or storage is completely secure. We encourage you to use a strong
              password and to notify us immediately if you suspect unauthorized access to your account.
            </p>
          </section>

          <section>
            <h2>10. Third-Party Links</h2>
            <p>
              The Platform may contain links to third-party websites or services. We are not responsible for the privacy
              practices of those third parties and encourage you to review their privacy policies.
            </p>
          </section>

          <section>
            <h2>11. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material changes by posting the
              new policy on this page with an updated date. Your continued use of the Platform after changes become
              effective constitutes your acceptance of the revised policy.
            </p>
          </section>

          <section>
            <h2>12. Contact Us</h2>
            <p>If you have questions or concerns about this Privacy Policy, please contact us:</p>
            <address>
              TheSeniorGuru<br />
              Basra Consulting Services<br />
              <a href="mailto:privacy@theseniorguru.com">privacy@theseniorguru.com</a>
            </address>
          </section>
        </div>
      </div>

      <footer className="site-footer">
        <strong>TheSeniorGuru</strong>
        <div className="footer-links">
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms of Service</Link>
          <a href="mailto:privacy@theseniorguru.com">privacy@theseniorguru.com</a>
        </div>
      </footer>
    </main>
  );
}
