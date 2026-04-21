"use client";

import React, { useState } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { 
  HelpCircle, 
  Mail, 
  MessageSquare, 
  Send, 
  CheckCircle2, 
  ChevronRight,
  Globe,
  Linkedin,
  Github,
  Twitter,
  Instagram 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";

export default function SupportPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFeedbackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      toast({
        title: "Feedback Submitted!",
        description: "Submitted successfully! Support will be reached in 1 to 2 days.",
      });
      (e.target as HTMLFormElement).reset();
    }, 1000);
  };

  const handleGmailRedirect = () => {
    const gmailUrl = "https://mail.google.com/mail/?view=cm&fs=1&to=preamsrinivas081@gmail.com&su=Support Request - LiveBus Tracker&body=Hello Support team,";
    window.open(gmailUrl, "_blank");
  };

  const faqs = [
    {
      q: "How do I track my bus in real-time?",
      a: "Go to your dashboard, enter your source and destination, and click on a route. The map will show the live position of all active buses on that route."
    },
    {
      q: "What is a 'Smart Pass' and how do I get one?",
      a: "A Smart Pass is your digital identity for bus access. You can find the request form in the Features section under 'Smart Pass'. It uses biometric verification for secure boarding."
    },
    {
      q: "The bus is delayed. How will I be notified?",
      a: "Our system sends push notifications and alerts to the 'Alerts Center' whenever a bus is running more than 5 minutes behind schedule."
    },
    {
      q: "Can I share my live trip with someone for safety?",
      a: "Yes! When you are tracking a route, click the 'Share Live Tracking' button to send a temporary tracking link to your friends or family."
    }
  ];

  const socialLinks = [
    { icon: Globe, href: "https://premkanth.netlify.app/", label: "Portfolio", color: "text-blue-600" },
    { icon: Linkedin, href: "https://www.linkedin.com/in/premkanth-ks-98b7a62bb", label: "LinkedIn", color: "text-blue-700" },
    { icon: Github, href: "https://github.com/premkanths", label: "GitHub", color: "text-zinc-900" },
    { icon: Twitter, href: "https://x.com/Premkant_h?t=QY0K37wRJg_PbU3mNhqB1w&s=09", label: "Twitter", color: "text-blue-400" },
    { icon: Instagram, href: "https://instagram.com/_prem_kanth_s_", label: "Instagram", color: "text-pink-600" },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col font-outfit">
      <DashboardHeader title="Support & Help" />

      <main className="flex-1 max-w-5xl mx-auto px-4 py-12 w-full space-y-12">
        {/* Header Section */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-3 bg-blue-600 rounded-3xl shadow-xl shadow-blue-200">
            <HelpCircle className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-black text-zinc-900 tracking-tight">How can we help?</h1>
          <p className="text-zinc-500 font-medium max-w-lg mx-auto">
            Find answers to common questions or reach out to our team directly for platform support.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {/* FAQ Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-xl shadow-sm border border-zinc-100">
                <MessageSquare className="w-5 h-5 text-blue-600" />
              </div>
              <h2 className="text-xl font-black text-zinc-900">Frequently Asked Questions</h2>
            </div>
            
            <Accordion type="single" collapsible className="w-full space-y-3">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`} className="border-none bg-white rounded-3xl px-6 py-1 shadow-sm border border-zinc-100">
                  <AccordionTrigger className="font-bold text-zinc-800 hover:no-underline">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-zinc-500 font-medium leading-relaxed">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          {/* Contact & Feedback */}
          <div className="space-y-8">
            {/* Direct Mail Card */}
            <Card className="rounded-[40px] p-8 border-none bg-zinc-900 text-white shadow-2xl overflow-hidden relative group">
              <div className="relative z-10 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white/10 rounded-2xl backdrop-blur">
                    <Mail className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black leading-none mb-1">Email Support</h3>
                    <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest">Fastest Response</p>
                  </div>
                </div>
                <p className="text-sm text-zinc-300 font-medium">
                  Direct concerns or project inquiries? Reach out via Gmail for a specialized response from our team.
                </p>
                <Button 
                  onClick={handleGmailRedirect}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-2xl h-12 font-black transition-all active:scale-95 group-hover:shadow-lg shadow-blue-500/40"
                >
                  Message preamsrinivas081@gmail.com
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 blur-[80px] -mr-16 -mt-16" />
            </Card>

            {/* Feedback Form */}
            <div className="bg-white rounded-[40px] p-8 shadow-sm border border-zinc-100 space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-zinc-50 rounded-xl">
                  <Send className="w-5 h-5 text-blue-600" />
                </div>
                <h2 className="text-xl font-black text-zinc-900">Send Feedback</h2>
              </div>
              
              <form onSubmit={handleFeedbackSubmit} className="space-y-4">
                <Input placeholder="Your Name" required className="rounded-2xl h-12 bg-zinc-50 border-none focus-visible:ring-blue-600" />
                <Textarea placeholder="How can we improve the LiveBus Tracker?" required className="rounded-2xl min-h-[120px] bg-zinc-50 border-none focus-visible:ring-blue-600 resize-none" />
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full rounded-2xl h-12 bg-zinc-900 hover:bg-black font-black"
                >
                  {isSubmitting ? "Submitting..." : "Submit Feedback"}
                  <CheckCircle2 className="w-4 h-4 ml-2" />
                </Button>
              </form>
            </div>
          </div>
        </div>

        {/* Social Reach */}
        <div className="pt-12 border-t border-zinc-200">
          <div className="flex flex-col items-center gap-8">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-400">Connect With The Founder</h3>
            <div className="flex flex-wrap justify-center gap-4">
              {socialLinks.map((social) => (
                <a 
                  key={social.label} 
                  href={social.href} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-white px-6 py-3 rounded-2xl border border-zinc-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all group"
                >
                  <social.icon className={`w-5 h-5 ${social.color}`} />
                  <span className="text-sm font-bold text-zinc-900">{social.label}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-12 text-center text-zinc-400 text-xs font-bold uppercase tracking-[0.2em]">
        LiveBus Tracker Support Center &copy; 2026
      </footer>
    </div>
  );
}
