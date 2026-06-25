import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FormWelcome } from "@/components/FormWelcome";
import { FormQuestionWithValidation } from "@/components/FormQuestionWithValidation";
import { FormComplete } from "@/components/FormComplete";
import { useToast } from "@/hooks/use-toast";

interface Question {
  id: string;
  type: "text" | "email" | "tel" | "textarea" | "select" | "date" | "file" | "checkbox";
  title: string;
  subtitle?: string;
  required: boolean;
  options?: string[];
  placeholder?: string;
  multiple?: boolean;
  maxFiles?: number;
  accept?: string;
  groups?: { label: string; icon: string; options: string[] }[];
}

const questions: Question[] = [
  { id: "fullName",    type: "text",  title: "1. Full Name",            required: true,  placeholder: "Ahmed Al Mansouri" },
  { id: "email",       type: "email", title: "2. Email Address",         required: true,  placeholder: "ahmed@email.com" },
  { id: "phone",       type: "tel",   title: "3. Phone / WhatsApp",      required: true,  placeholder: "+971 50 000 0000" },
  { id: "emergency",   type: "tel",   title: "4. Emergency Contact",     required: true,  placeholder: "+971 50 000 0001" },
  {
    id: "gender", type: "select", title: "5. Gender", required: true,
    options: ["Male", "Female", "Prefer not to say"],
  },
  { id: "dob",         type: "date",  title: "6. Date of Birth",         required: true  },
  { id: "nationality", type: "text",  title: "7. Nationality",           required: true,  placeholder: "e.g. Emirati, Indian…" },
  { id: "homeCountry", type: "text",  title: "8. Home Country",          required: true,  placeholder: "e.g. UAE, India…" },
  { id: "occupation",  type: "text",  title: "9. Occupation",            required: true,  placeholder: "e.g. Trader, Engineer…" },
  { id: "emiratesId",  type: "text",  title: "10. Emirates ID Number",   required: true,  placeholder: "784-XXXX-XXXXXXX-X" },
  {
    id: "countryAttendance", type: "select", title: "11. Country of Attendance", required: true,
    options: ["United Arab Emirates","Saudi Arabia","Kuwait","Qatar","Bahrain","Oman","India","Pakistan","Philippines","United Kingdom","United States","Other"],
  },
  { id: "villaApartment", type: "text",     title: "12. Villa / Apartment",          required: true,  placeholder: "e.g. Villa 12, Flat 3B, Building Name…" },
  { id: "cityTown",       type: "text",     title: "13. City / Town",                required: true,  placeholder: "e.g. Dubai, Abu Dhabi, Sharjah…" },
  { id: "addressCountry", type: "text",     title: "14. Country",                    required: true,  placeholder: "e.g. UAE, India, United Kingdom…" },
  { id: "passportFile", type: "file", title: "15. Passport Copy",        required: true,  subtitle: "Upload a clear copy of your passport (PDF, JPG or PNG · Max 5 MB)", multiple: false, maxFiles: 1 },
  { id: "photoFile",    type: "file", title: "16. Professional Photo",   required: false, subtitle: "Passport size preferred (JPG or PNG) · Optional", multiple: false, maxFiles: 1, accept: "image/*" },
  {
    id: "level", type: "select", title: "17. Experience Level", required: true,
    options: ["Beginner", "Intermediate", "Advanced"],
  },
  { id: "startDate", type: "date",  title: "18. Preferred Start Date",  required: true },
  {
    id: "source", type: "select", title: "19. How did you hear about us?", required: true,
    options: ["Instagram","TikTok","WhatsApp","Friend / Referral","Google","Walk-in"],
  },
  { id: "referralName", type: "text", title: "Who referred you?", required: false, subtitle: "Enter the full name of the person who referred you", placeholder: "e.g. Ahmed Al Mansouri" },
  {
    id: "courses", type: "checkbox", title: "20. Select Program & Courses", required: true,
    subtitle: "Choose one or more courses you wish to enroll in",
    groups: [
      { label: "Forex Academy",      icon: "📈", options: ["Market Break Out","Delta Wave Theory"] },
      { label: "Digital Marketing",  icon: "📢", options: ["Digital Marketing"] },
      { label: "AI Academy",         icon: "🤖", options: ["AI & Machine Learning"] },
    ],
    options: ["Market Break Out","Delta Wave Theory",],
  },
  {
    id: "payment", type: "select", title: "21. Payment Method", required: true,
    options: ["Cash - Full","Card - Full","Card - Split","Card - Debit","Card - Credit","USDT","Tabby (Buy Now Pay Later)","Tamara (Buy Now Pay Later)"],
  },
  {
    id: "termsAgreed", type: "checkbox", title: "22. Terms & Conditions", required: true,
    subtitle: `TERMS AND CONDITIONS\nDelta International Management Development Training – Amended 10th May 2026\n\nThe Terms and Conditions ("Terms") agreed herein govern the participation of the undersigned student ("you" or "Student") in any forex trading course or related course ("Course") offered by Delta International Management Development Training ("Delta", "we", or "us"), an educational initiative providing instructional courses in forex trading and related subjects.\n\n1. ACCEPTANCE OF THE TERMS\n• By registering for the Course offered by Delta, either through online platforms or in-person enrolment, you acknowledge that you have read, understood, and agreed to be bound by these Terms in full.\n• Enrolment to the Course is subject to availability and is not guaranteed until explicitly confirmed by us as per the Terms herein. We reserve the right to accept or reject any application for enrolment at our sole discretion.\n\n2. NATURE AND SCOPE OF THE COURSE\n• The Course is intended and offered solely for educational and informational purposes relating to virtual and forex trading (the "Subject"), and does not constitute any kind of professional, financial, legal or investment advice, or solicitation to trade.\n• Delta makes no warranties or representations as to the accuracy, completeness, or usefulness of the Course. You agree that any trading or investment decisions are made independently at your sole risk.\n• Delta shall not be liable for any losses, financial or otherwise, arising out of or in connection with the Course content or actions taken based on it.\n\n3. COURSE MATERIALS AND INTELLECTUAL PROPERTY\n• All Course content, including but not limited to logos, trademarks, trade names, copyrights, and any videos, presentations, slides, written materials, images, and lectures (collectively, the "Course Content") shall be the exclusive property of Delta. All intellectual property rights over the Course Content are hereby reserved by Delta.\n• Upon enrolment, you are granted a limited, non-exclusive, non-transferable, revocable license to access and use the Course Content solely for purposes relating to the Subject as agreed herein.\n• Any form of unauthorized storage, reproduction, distribution, modification, public display, or commercial use of any Course Content is strictly prohibited and may result in immediate legal action, including seeking injunctive relief or damages, and termination of enrolment of the Student.\n\n4. COURSE FEES AND PAYMENT\n• All Course fees must be paid in full prior to commencement, unless otherwise agreed in writing by Delta. Any instalment or deferred payment arrangements must be strictly adhered to as mutually agreed.\n• Any fees paid are non-refundable and non-transferable under any circumstances, including withdrawal, termination, dissatisfaction, or partial completion.\n• Enrolment shall be deemed complete only upon:\n  – Submission of completed registration documents,\n  – Payment and receipt of fees as agreed, and\n  – Issuance of official confirmation from Delta via email or written notice.\n• Delta reserves the right to withhold services or disqualify any Student for reasons including, but not limited to, any payment failure, misrepresentation, false information, and/or breach of any Terms herein.\n• Please refer to our Payment and Refund Policy for further details.\n\n5. EDUCATIONAL TRADING CREDIT\n• As part of the Course, Delta may provide the Student with access to a trading credit scheme ("Trading Credit") offered by an independent third-party brokerage company ("Broker") for the purpose of gaining experience trading on a trading platform ("Platform").\n• Creation of the account with the Broker and availing the Trading Credit shall be entirely voluntary and at the sole discretion of the Student. Any such access provided shall be subject to successful registration, KYC completion, and approval by the Broker.\n• The Trading Credit provided shall be subject to the Broker's terms and conditions. Delta does not own, operate, or control the Platform or the Broker and shall not be held liable directly or indirectly, for the actions, omissions or decisions of the Broker or the Platform in any manner. The Trading Credit cannot be redeemed for cash or withdrawn in any other manner. However, profit earned through trading, above and beyond the Trading Credit, shall be available for withdrawal subject to charges and withdrawal limits of the Broker.\n• The Trading Credit does not form part of the Course fee, nor does it constitute a guaranteed benefit, right or entitlement in any manner. You acknowledge and agree that any participation or interaction with the Broker is undertaken at your sole risk and responsibility, and that Delta and/or any of its employees, instructors, agents, and partners (together as the "Affiliates") shall not be liable in any manner whatsoever in relation to such participation.\n\n6. CODE OF CONDUCT\n• Students must at all times:\n  – Conduct themselves in a respectful and professional manner, as ordinarily expected from a student;\n  – Abide by all rules, regulations, and policies communicated during the Course.\n• Delta reserves the right to suspend or expel any Student, without refund or notice, for any:\n  – Disruptive, harassing, abusive, or unethical conduct or behavior;\n  – Misuse or unauthorized sharing of Course Content;\n  – Academic dishonesty or fraudulent activity.\n\n7. DISCLAIMERS AND LIMITATION OF LIABILITY\n• Trading in financial markets involves substantial risk. You acknowledge and agree that any past performance is not indicative of future results.\n• To the extent permitted by law, Delta and/or its Affiliates shall not be liable for any:\n  – Direct, indirect, incidental, special, or consequential damages;\n  – Loss of profits, capital, data, or goodwill;\n  – Technical failures, internet disruptions, or platform outages;\n  – Any other damages resulting from your decision to take part in or conduct any form of trading or related activity during or after the term of the Course.\n• You agree to indemnify, defend and hold harmless Delta and its Affiliates from any claims, damages, expenses or liabilities arising from the breach of these Terms, any trading activity or your conduct during or after the term of the Course.\n\n8. DATA PROTECTION AND PRIVACY\n• You agree to provide accurate, current, and complete information for registration and during the term of this Course.\n• Your personal data shall be collected, stored and processed in accordance with applicable data protection laws of the UAE.\n• Delta shall not share your information with any third parties except as required by law.\n\n9. AMENDMENTS AND MODIFICATIONS\n• Delta reserves the right, at its sole discretion, to:\n  – Amend, revise, or update these Terms;\n  – Modify Course structure, content, fees, or instructors;\n  – Suspend or discontinue the Course in whole or in part.\n• Any amendments or modifications to the Terms shall be published on Delta's website. Continued participation or attendance in the Course after any such amendment constitutes acceptance of the revised Terms.\n\n10. TERM AND TERMINATION\n• These Terms shall come into effect from the date of your enrolment in the Course, as confirmed in writing by Delta, or the date of your signing or acceptance of the terms, whichever is earlier ("Effective Date"), and shall remain in force until the completion of the Course, unless earlier terminated in accordance with the provisions herein.\n• Upon termination for any reason:\n  – The Student's access to the Course Content, platforms, and any materials shall cease immediately;\n  – The Student shall immediately cease all use of the Course Content and return, delete or destroy any copies in their possession;\n  – Termination shall be without prejudice to any accrued rights, remedies, or obligations of Delta under these Terms, including its right to seek damages, enforce indemnities, or pursue any other remedies available under law.\n\n11. SEVERABILITY\n• If any provision of these Terms is found to be invalid, void, or unenforceable under applicable law, such provision shall be severed without affecting the validity of the remaining Terms, which shall remain in full force and effect.\n\n12. GOVERNING LAW AND DISPUTE RESOLUTION\n• These Terms shall be governed by and construed in accordance with the applicable Federal laws of the United Arab Emirates and the local laws of the Emirate of Dubai.\n• Any disputes arising from or relating to these Terms shall be first resolved amicably through mutual negotiations. In case of failure to settle the dispute within thirty days of initiating such negotiation, the matter shall be exclusively submitted to the Courts of the Emirate of Dubai.\n\n13. ACKNOWLEDGEMENT AND ACCEPTANCE\n• By signing below or submitting your registration form electronically, you confirm that you have read, understood, and agreed to be legally bound by these Terms in full.`,
    options: ["I have read, understood, and agree to Delta Institutions' Terms & Conditions, including the No Refund Policy. I confirm all information provided is accurate."],
  },
];

const STORAGE = {
  step:  "enrollCurrentStep",
  index: "enrollCurrentQuestionIndex",
  ans:   "enrollAnswers",
};

const Index = () => {
  const [currentStep, setCurrentStep] = useState<"welcome" | "questions" | "complete">(
    (localStorage.getItem(STORAGE.step) as any) || "welcome",
  );
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(
    parseInt(localStorage.getItem(STORAGE.index) || "0"),
  );
  const [answers, setAnswers] = useState<Record<string, any>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE.ans) || "{}");
      delete saved.passportFile;
      delete saved.photoFile;
      return saved;
    } catch { return {}; }
  });
  const [direction, setDirection] = useState<"left" | "right">("left");
  const [loading, setLoading] = useState(false);
  const [showPassportAlert, setShowPassportAlert] = useState(false);
  const { toast } = useToast();

  // ── KEY FIX: track whether the last action was navigating back ──────────
  // This prevents auto-advance from firing when returning to a select question
  const navigatedBackRef = useRef(false);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE.step,  currentStep);
    localStorage.setItem(STORAGE.index, currentQuestionIndex.toString());
    const toSave = { ...answers };
    delete toSave.passportFile;
    delete toSave.photoFile;
    localStorage.setItem(STORAGE.ans, JSON.stringify(toSave));
  }, [currentStep, currentQuestionIndex, answers]);

  const handleStart = () => { setCurrentStep("questions"); setCurrentQuestionIndex(0); };

  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleNext = async () => {
    const q   = questions[currentQuestionIndex];
    const ans = answers[q.id];

    if (q.required) {
      if (q.type === "file") {
        const ok = Array.isArray(ans) ? ans.length > 0 : ans instanceof File;
        if (!ok) { toast({ title: "Required", description: "Please upload the required file.", variant: "destructive" }); return; }
      } else if (!ans || ans?.trim?.() === "") {
        return;
      }
    }

    if (currentQuestionIndex < questions.length - 1) {
      setDirection("left");
      let nextIdx = currentQuestionIndex + 1;
      if (questions[nextIdx]?.id === "referralName" && answers.source !== "Friend / Referral") nextIdx++;
      setCurrentQuestionIndex(nextIdx);
    } else {
      // ── Final safety check: passport is mandatory ──────────────────────
      const passport = answers.passportFile;
      const hasPassport = Array.isArray(passport) ? passport.length > 0 : passport instanceof File;
      if (!hasPassport) {
        setShowPassportAlert(true);
        return;
      }

      // Last question — submit data immediately, then show success screen
      try {
        await handleSubmit();
        setCurrentStep("complete");
      } catch {
        // toast already shown in handleSubmit; stay on Q21
      }
    }
  };

  const goToPassport = () => {
    setShowPassportAlert(false);
    navigatedBackRef.current = true;
    setDirection("right");
    setCurrentQuestionIndex(14); // Q15 — Passport Copy (0-indexed)
  };

  const handlePrevious = () => {
    if (currentStep === "complete") {
      // ── Back from complete screen → go back to last question ──────────
      navigatedBackRef.current = true;
      setDirection("right");
      setCurrentStep("questions");
      setCurrentQuestionIndex(questions.length - 1);
      return;
    }
    if (currentQuestionIndex > 0) {
      navigatedBackRef.current = true;   // <── suppress auto-advance
      setDirection("right");
      let prevIdx = currentQuestionIndex - 1;
      if (questions[prevIdx]?.id === "referralName" && answers.source !== "Friend / Referral") prevIdx--;
      setCurrentQuestionIndex(prevIdx);
    }
  };

  // Auto-advance for select — but NOT when navigating back
  useEffect(() => {
    if (navigatedBackRef.current) {
      navigatedBackRef.current = false;  // clear the flag, don't advance
      return;
    }
    const q = questions[currentQuestionIndex];
    if (q?.type === "select" && answers[q.id]) {
      const t = setTimeout(handleNext, 350);
      return () => clearTimeout(t);
    }
  }, [answers, currentQuestionIndex]);   // eslint-disable-line

  /* ── file helpers ───────────────────────────────────────────────── */
  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onload  = () => res((r.result as string).split(",")[1]);
      r.onerror = () => rej(new Error("Failed to read file"));
      r.readAsDataURL(file);
    });

  const handleSubmit = async () => {
    try {
      setLoading(true);

      const toFile = async (raw: any) => {
        const f = Array.isArray(raw) ? raw[0] : raw;
        if (!(f instanceof File)) return null;
        return { name: f.name, data: await fileToBase64(f), mimeType: f.type, size: f.size };
      };

      const payload = {
        fullName:          answers.fullName          || "",
        email:             answers.email             || "",
        phone:             answers.phone             || "",
        emergency:         answers.emergency         || "",
        gender:            answers.gender            || "",
        dob:               answers.dob               || "",
        nationality:       answers.nationality       || "",
        homeCountry:       answers.homeCountry       || "",
        occupation:        answers.occupation        || "",
        emiratesId:        answers.emiratesId        || "",
        countryAttendance: answers.countryAttendance || "",
        villaApartment:    answers.villaApartment    || "",
        cityTown:          answers.cityTown          || "",
        addressCountry:    answers.addressCountry    || "",
        level:             answers.level             || "",
        startDate:         answers.startDate         || "",
        source:            answers.source            || "",
        referralName:      answers.source === "Friend / Referral" ? (answers.referralName || "") : "",
        // checkbox values stored as "|"-joined; convert to readable ", "-joined for the sheet
        courses:           (answers.courses || "").split("|").filter(Boolean).join(", "),
        payment:           answers.payment           || "",
        termsAgreed:       answers.termsAgreed       ? "Yes" : "No",
        passportFile:      await toFile(answers.passportFile),
        photoFile:         await toFile(answers.photoFile),
      };

      const res    = await fetch("https://script.google.com/macros/s/AKfycbyWfoxP13JuIHJOirAD-wBxA1MaxJFwg_X9HnrH1rh_3DgPPfAEmGyw3qzYADqUzvOP/exec", {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();

      if (result.status === "success") {
        toast({ title: "Enrollment Submitted!", description: "Our team will contact you on WhatsApp shortly." });
        localStorage.removeItem(STORAGE.step);
        localStorage.removeItem(STORAGE.index);
        localStorage.removeItem(STORAGE.ans);
        return { success: true };
      }
      throw new Error(result.message || "Submission failed");
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to submit", variant: "destructive" });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterAnother = () => {
    localStorage.removeItem(STORAGE.step);
    localStorage.removeItem(STORAGE.index);
    localStorage.removeItem(STORAGE.ans);
    setAnswers({});
    setCurrentQuestionIndex(0);
    setDirection("left");
    setCurrentStep("welcome");
  };

  const currentQuestion = questions[currentQuestionIndex];
  const currentAnswer   = currentQuestion ? answers[currentQuestion.id] ?? "" : "";

  const canGoNext = currentQuestion
    ? !currentQuestion.required ||
      (currentQuestion.type === "file"
        ? Array.isArray(currentAnswer) ? currentAnswer.length > 0 : currentAnswer instanceof File
        : currentAnswer && currentAnswer?.trim?.() !== "")
    : false;

  if (currentStep === "welcome")  return <FormWelcome onStart={handleStart} />;
  if (currentStep === "complete") return <FormComplete onRegisterAnother={handleRegisterAnother} />;

  return (
    <>
      <AnimatePresence mode="wait" custom={direction}>
        <FormQuestionWithValidation
          key={currentQuestionIndex}
          question={currentQuestion as any}
          questionNumber={currentQuestionIndex + 1}
          totalQuestions={questions.length}
          value={currentAnswer}
          onChange={v => handleAnswerChange(currentQuestion.id, v)}
          onNext={handleNext}
          onPrevious={handlePrevious}
          canGoNext={canGoNext}
          isFirst={currentQuestionIndex === 0}
          isLast={currentQuestionIndex === questions.length - 1}
          allAnswers={answers}
          direction={direction}
          isSubmitting={loading}
        />
      </AnimatePresence>

      {/* ── Passport missing — warning modal ── */}
      <AnimatePresence>
        {showPassportAlert && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-5"
            style={{ background: "rgba(0,30,70,0.55)", backdropFilter: "blur(6px)" }}
            onClick={() => setShowPassportAlert(false)}
          >
            <motion.div
              initial={{ scale: 0.88, opacity: 0, y: 24 }}
              animate={{ scale: 1,    opacity: 1, y: 0  }}
              exit={{    scale: 0.92, opacity: 0, y: 12 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center"
              onClick={e => e.stopPropagation()}
            >
              {/* Icon */}
              <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center text-3xl mx-auto mb-4 shadow-sm">
                🛂
              </div>

              {/* Title */}
              <h2 className="text-lg font-extrabold text-slate-900 mb-1 tracking-tight">
                Passport Copy Required
              </h2>

              {/* Message */}
              <p className="text-slate-500 text-sm leading-relaxed mb-5">
                A clear copy of your passport is{" "}
                <span className="font-bold text-red-500">mandatory</span> to complete enrollment.
                Please upload it before submitting.
              </p>

              {/* Question indicator */}
              <div className="flex items-center justify-center gap-2 mb-5">
                <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-600 text-xs font-bold px-3 py-1.5 rounded-full">
                  <span>📋</span> Question 14 — Passport Copy
                </div>
              </div>

              {/* Buttons */}
              <div className="flex flex-col gap-2.5">
                <button
                  onClick={goToPassport}
                  className="w-full py-3 rounded-xl bg-primary text-white text-sm font-extrabold tracking-wide shadow-md hover:bg-primary/90 active:scale-95 transition-all"
                >
                  Upload Passport Now →
                </button>
                <button
                  onClick={() => setShowPassportAlert(false)}
                  className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-500 text-sm font-semibold hover:bg-slate-200 active:scale-95 transition-all"
                >
                  Stay Here
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Index;
