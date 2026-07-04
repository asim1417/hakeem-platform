import { extractTextFromDocument } from './GeminiOcrService.js';

async function handleUserUpload() {
  // يرجى وضع ملف تجريبي باسم sample.png في نفس المجلد لتجربته
  const userFile = './sample.png'; 
  
  try {
    console.log('جاري معالجة الوثيقة وقراءتها عبر خدمة Gemini...');
    
    // استدعاء الخدمة باستخدام نموذج flash السريع والاقتصادي
    const extractedText = await extractTextFromDocument(userFile, 'flash');
    
    console.log('\n--- تم استخراج النص بنجاح ---:\n');
    console.log(extractedText);
    
  } catch (error) {
    console.error('\nحدث خطأ أثناء تشغيل الخدمة:', error.message);
  }
}

// تشغيل التجربة
handleUserUpload();
