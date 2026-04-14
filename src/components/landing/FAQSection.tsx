import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "Do I need to know how to code?",
    a: "Not at all. Just describe your app in plain English and our AI handles the rest. You can refine with follow-up prompts without writing a single line of code.",
  },
  {
    q: "What kind of apps can I build?",
    a: "Anything from e-commerce stores and fitness trackers to marketplaces and internal tools. If it can be a mobile app, you can build it here.",
  },
  {
    q: "Do I own the code?",
    a: "Yes, 100%. You can export the full source code at any time. There's no lock-in or vendor dependency.",
  },
  {
    q: "How fast can I go from idea to a working app?",
    a: "Most users have a working prototype in under 10 minutes. From there, you can iterate and refine as much as you need before launching.",
  },
  {
    q: "Can I connect a backend or database?",
    a: "Absolutely. ApexBuild can generate apps with authentication, database models, and API integrations built in. You can also connect your own backend.",
  },
];

const FAQSection = () => {
  return (
    <section id="faq" className="section-padding">
      <div className="container-narrow max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="font-display text-3xl sm:text-4xl font-bold">
            Frequently asked <span className="gradient-text">questions</span>
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`item-${i}`}
                className="glass-panel px-6 border border-border/50 data-[state=open]:border-primary/30"
              >
                <AccordionTrigger className="text-left font-display font-medium text-base hover:no-underline py-5">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground pb-5 leading-relaxed">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
};

export default FAQSection;
