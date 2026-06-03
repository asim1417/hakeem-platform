export const trainingPaths = [
  {
    key: "claim-drafting",
    title: "صياغة صحيفة الدعوى",
    description: "تدريب على ترتيب الوقائع والطلبات والاختصاص والبينات.",
    exercise: "اكتب مسودة مختصرة لصحيفة دعوى مطالبة مالية تتضمن الوقائع والطلبات."
  },
  {
    key: "legal-characterization",
    title: "التكييف القانوني للوقائع",
    description: "تمييز الوصف النظامي الأقرب للوقائع وربطه بالمكتبة النظامية.",
    exercise: "حدد التكييف القانوني لواقعة توريد مواد غير مطابقة للمواصفات."
  },
  {
    key: "defenses",
    title: "بناء الدفوع",
    description: "صياغة دفوع شكلية وموضوعية بلغة عملية منضبطة.",
    exercise: "اكتب ثلاثة دفوع يمكن أن يتمسك بها المدعى عليه في نزاع تجاري."
  },
  {
    key: "evidence-analysis",
    title: "تحليل البينات",
    description: "تقييم المستندات والقرائن وربطها بنقاط النزاع.",
    exercise: "حلل أثر محضر الاستلام وتقرير الفحص في نزاع مواد معيبة."
  },
  {
    key: "training-judgment",
    title: "صياغة حكم تدريبي",
    description: "بناء أسباب ومنطوق حكم تدريبي غير ملزم.",
    exercise: "اكتب منطوق حكم تدريبي مختصر في مطالبة خصم قيمة مواد معيبة."
  }
];

export function trainingPathTitle(pathKey: string) {
  return trainingPaths.find((path) => path.key === pathKey)?.title ?? pathKey;
}
