import AppHeader from '@/components/AppHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center">Privacy Policy</CardTitle>
            <p className="text-center text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
          </CardHeader>
          
          <CardContent className="prose max-w-none space-y-6">
            <section>
              <h2 className="text-2xl font-semibold mb-4">1. Information We Collect</h2>
              <div className="space-y-3 text-muted-foreground">
                <p>We collect information you provide directly to us, such as when you:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Create an account or profile</li>
                  <li>Create or join live streaming events</li>
                  <li>Use our camera streaming features</li>
                  <li>Contact us for support</li>
                </ul>
                <p>This may include your name, email address, and any content you share through our platform.</p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">2. How We Use Your Information</h2>
              <div className="space-y-3 text-muted-foreground">
                <p>We use the information we collect to:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Provide, maintain, and improve our streaming services</li>
                  <li>Process and manage your live streaming events</li>
                  <li>Send you technical notices and support messages</li>
                  <li>Respond to your comments and questions</li>
                  <li>Ensure the security and integrity of our platform</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">3. Information Sharing and Disclosure</h2>
              <div className="space-y-3 text-muted-foreground">
                <p>We may share your information in the following circumstances:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>With your consent or at your direction</li>
                  <li>With service providers who assist us in operating our platform</li>
                  <li>To comply with laws, regulations, or legal requests</li>
                  <li>To protect the rights, property, or safety of our users or others</li>
                </ul>
                <p>We do not sell, trade, or otherwise transfer your personal information to third parties for commercial purposes.</p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">4. Data Security</h2>
              <div className="space-y-3 text-muted-foreground">
                <p>We implement appropriate security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the internet is 100% secure.</p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">5. Live Streaming Content</h2>
              <div className="space-y-3 text-muted-foreground">
                <p>When you participate in live streaming events:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Your video and audio may be recorded and stored temporarily</li>
                  <li>Content may be visible to other participants in the event</li>
                  <li>Event organizers have control over recording and sharing permissions</li>
                  <li>You are responsible for the content you share during streams</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">6. Your Rights and Choices</h2>
              <div className="space-y-3 text-muted-foreground">
                <p>You have the right to:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Access and update your personal information</li>
                  <li>Delete your account and associated data</li>
                  <li>Opt out of certain communications</li>
                  <li>Request a copy of your data</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">7. Children's Privacy</h2>
              <div className="space-y-3 text-muted-foreground">
                <p>Our service is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13.</p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">8. Changes to This Privacy Policy</h2>
              <div className="space-y-3 text-muted-foreground">
                <p>We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.</p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">9. Contact Us</h2>
              <div className="space-y-3 text-muted-foreground">
                <p>If you have any questions about this Privacy Policy, please contact us through our support channels.</p>
              </div>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}