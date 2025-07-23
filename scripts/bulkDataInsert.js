import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { DEFAULT_PASSWORD } from '../services/invitationConfig.js';

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_NAME = 'Conservatory-DB'; // Database name from the URI

// All teachers from the JSON (filtered to remove invalid entries)
const allTeachers = [
  {"שם מלא":"סבטלנה אברהם","כלי":"כינור","טלפון":"054-2-192466","אימייל":"svetlana.abram@gmail.com"},
  {"שם מלא":"אירנה אוסטרובסקי","כלי":"פסנתר","טלפון":"052-3-955858","אימייל":"irinaost64@gmail.com"},
  {"שם מלא":"מאיה איצקוביץ ","כלי":"חצוצרה","טלפון":"054-7415528","אימייל":"itzkovich3@gmail.com"},
  {"שם מלא":"מריאנה אלטנגוף","כלי":"גיטרה","טלפון":"054-4302969","אימייל":"mariannaalt1527@gmail.com"},
  {"שם מלא":"אלה  אסטחוב  ","כלי":"פסנתר","טלפון":"050-4-846095","אימייל":"Alunya.7@gmail.com"},
  {"שם מלא":"דור אסף","כלי":"טרומבון ","טלפון":"052-5774009","אימייל":"dorasaf123@gmail.com"},
  {"שם מלא":"לימור אקטע ","כלי":"מנהלת","טלפון":"052-8197173","אימייל":"limora@raanana.muni.il"},
  {"שם מלא":"תמיר אקטע ","כלי":"חצוצרה","טלפון":"052-8-197174","אימייל":"tamir.akta@gmail.com"},
  {"שם מלא":"אנה ארונזון","כלי":"כינור","טלפון":"052-5952650","אימייל":"anna.aronzon1@gmail.com"},
  {"שם מלא":"אבנר בדוח","כלי":"אב בית","טלפון":"050-3261860","אימייל":"avnerba@raanana.muni.il"},
  {"שם מלא":"דבורה בוהק ","כלי":"ספרנית","טלפון":"054-4478835","אימייל":"Dbohak@gmail.com"},
  {"שם מלא":"נטליה בלסקי ","כלי":"פסנתר","טלפון":"054-5483308","אימייל":"belsky1964@gmail.com"},
  {"שם מלא":"דניאל בן חורין","כלי":"גיטרה בס \/מגמה","טלפון":"050-5275578","אימייל":"danielbenhorin@yahoo.com"},
  {"שם מלא":"משה בן יוחנה ","כלי":"בס וסגן מנהל","טלפון":"050-7-595534","אימייל":" mosheby.rmc@gmail.com"},
  {"שם מלא":"רוני בר","כלי":"פסנתר","טלפון":"054-8108760","אימייל":"ronibass123@gmail.com"},
  {"שם מלא":"מרסל ברגמן ","כלי":"צ'לו","טלפון":"052-6610884","אימייל":"annberg11@gmail.com"},
  {"שם מלא":"גל ברגר","כלי":"גיטרה חשמלית","טלפון":"050-2441988","אימייל":"galgalon96@gmail.com"},
  {"שם מלא":"יבגני ברכמן","כלי":"פסנתר","טלפון":"053-4728013","אימייל":"ebrakhman@gmail.com"},
  {"שם מלא":"רועי ברום ","כלי":"תופים ","טלפון":"054-2424845","אימייל":" rbrom36@gmail.com"},
  {"שם מלא":"אייל ברנד ","כלי":"גיטרה חשמלית","טלפון":"052-8-347433","אימייל":"Eyalbrand@gmail.com"},
  {"שם מלא":"מירב ברנע","כלי":"פיתוח קול","טלפון":"0544-878641","אימייל":"meravbarnea@gmail.com"},
  {"שם מלא":" אבי ברק","כלי":"תופים","טלפון":"050-6908861","אימייל":"Avi@avibarak.com"},
  {"שם מלא":"מארק גילנסון ","כלי":"קונטרבס","טלפון":"053-5328035","אימייל":"markgilenson@gmail.com "},
  {"שם מלא":"רני גולן","כלי":"מקהלה","טלפון":"052-8348404","אימייל":"ranigolan76@gmail.com"},
  {"שם מלא":"מעיין  גור אריה ","כלי":"חצוצרה","טלפון":"052-4865577","אימייל":"maaynga@gmail.com"},
  {"שם מלא":"יונתן גיטלמן","כלי":"תופים","טלפון":"054-8079202","אימייל":"gitelman3@gmail.com"},
  {"שם מלא":"ויטה גורביץ","כלי":"קול קלאסי","טלפון":"052-8463515","אימייל":"vitagur0604@gmail.com"},
  {"שם מלא":"מיכאל גורפינקל","כלי":"קלרינט","טלפון":"052-5702531","אימייל":"madgur2@gmail.com"},
  {"שם מלא":"יניב דאור ","כלי":"פיתוח קול ","טלפון":"052-3096270","אימייל":"yanivedor@gmail.com"},
  {"שם מלא":"אלכס דולוב","כלי":"צ`לו","טלפון":"052-7265426","אימייל":"sasha.doulov@gmail.com"},
  {"שם מלא":"דבורה דרעי","כלי":"פיתוח קול","טלפון":"052-4227324","אימייל":"deborahdery@gmail.com"},
  {"שם מלא":"כפיר הררי ","כלי":"פסנתר","טלפון":"052-4591407","אימייל":"pianistkfirharari@gmail.com"},
  {"שם מלא":" ג'ף הוארד","כלי":"תזמורת הנוער","טלפון":"054-7-268531","אימייל":"jeffhowardjeffhoward@yahoo.com"},
  {"שם מלא":"שני הורביץ","כלי":"חליל","טלפון":"054-7-718970","אימייל":"shanni.mail@gmail.com"},
  {"שם מלא":"ליאור וירוט ","כלי":"אבוב","טלפון":"050-3554888","אימייל":"Lmv.oboe@gmail.com"},
  {"שם מלא":"זכריאל (זכי) ודובץ ","כלי":"סקסופון","טלפון":"052-5707536","אימייל":"zakizak55@gmail.com"},
  {"שם מלא":"אורי ונטורה ","כלי":"גיטרה","טלפון":"050-6380496","אימייל":"oriventura@gmail.com"},
  {"שם מלא":"מתן ורדי","כלי":"סקסופון","טלפון":"054-6866525","אימייל":"lordvardi@gmail.com"},
  {"שם מלא":"טל ורון ","כלי":"סקסופון","טלפון":"052-5676477","אימייל":"talvaron@gmail.com"},
  {"שם מלא":"אלה ואולין ","כלי":"כינור","טלפון":"052-4409312","אימייל":"ellavaulin@gmail.com"},
  {"שם מלא":"רותי ורון ","כלי":"קרן יער","טלפון":"052-4625200","אימייל":"varonruty@gmail.com"},
  {"שם מלא":"מעיין זיטמן ","כלי":"פיתוח  קול","טלפון":"054-7444124","אימייל":"Mazeporat@gmail.com"},
  {"שם מלא":"מרינה זיסקינד ","כלי":"כינור","טלפון":"054-6-665847","אימייל":"marina.ziskind1@gmail.com"},
  {"שם מלא":"אולגה זלמנוב","כלי":"תאוריה","טלפון":"050-7333583","אימייל":"ozelmanov@gmail.com"},
  {"שם מלא":"אלכסנדרה זנגייב","כלי":"פסנתר","טלפון":"050-7179753","אימייל":"pianistka2004@walla.com"},
  {"שם מלא":"יונתן חרותי ","כלי":"גיטרה","טלפון":"054-7797822","אימייל":"jonatanheruti@gmail.com"},
  {"שם מלא":"ירון חסון","כלי":"גיטרה","טלפון":"054-5911010","אימייל":"yaronhassonguitar@gmail.com"},
  {"שם מלא":"חוליאטה טולצ'ינסקי ","כלי":"פסנתר","טלפון":"052-8-572110","אימייל":"Julietatolchinsky@yahoo.com.ar"},
  {"שם מלא":"לריסה יומדין ","כלי":"חליל","טלפון":"054-5606847","אימייל":"Lora.iomdin@gmail.com"},
  {"שם מלא":"מאיה יצחקוב","כלי":"חליל צד","טלפון":"054-6421090","אימייל":"maushka10@walla.com"},
  {"שם מלא":"יונתן ישיעהו ","כלי":"חצוצרה","טלפון":"054-2395020","אימייל":"yona279@gmail.com"},
  {"שם מלא":"אולג יקרביץ'","כלי":"פסנתר","טלפון":"054-5251703","אימייל":"oleg.tamar@gmail.com"},
  {"שם מלא":"חיים כהן","כלי":"אב בית","טלפון":"054-6622983","אימייל":"haimc@raanana.muni.il"},
  {"שם מלא":"יובל כהן ","כלי":"סקסופון","טלפון":"052-3-565277","אימייל":"yuvalcohenmusic@gmail.com"},
  {"שם מלא":"רועי כהן ","כלי":"קלרינט","טלפון":"054-2226372","אימייל":"roeico15@walla.co.il"},
  {"שם מלא":"עומר כץ ","כלי":"קלרינט","טלפון":"054-5735753","אימייל":"omerke26@gmail.com"},
  {"שם מלא":"אורלי לבן ","כלי":"גיטרה","טלפון":"052-7429955","אימייל":"orlylavan1@gmail.com"},
  {"שם מלא":"לילה לומי ","כלי":"מלווה ","טלפון":"053-6214809","אימייל":"lumilaila@yandex.ru"},
  {"שם מלא":"יורי לוגצ'וב ","כלי":"פסנתר","טלפון":"054-5813029","אימייל":"yoray7@gmail.com"},
  {"שם מלא":"יהושע לוי","כלי":"פסנתר ג`אז","טלפון":"058-6739888","אימייל":" joshualevy6390@gmail.com"},
  {"שם מלא":"ורוניקה לוין","כלי":"כינור","טלפון":"054-6312877","אימייל":"veronica71428@gmail.com"},
  {"שם מלא":" יהושע לימוני","כלי":"תופים","טלפון":"052-3-923278","אימייל":"Ylimony@gmail.com"},
  {"שם מלא":"יואב ליפשיץ","כלי":"כלי הקשה","טלפון":"054-4517996","אימייל":"Yoavlif@walla.com"},
  {"שם מלא":"דימה מזור","כלי":"בסון","טלפון":"054-5963147","אימייל":"mazor.dmitry@gmail.com"},
  {"שם מלא":"הרן מלצר ","כלי":"צ`לו","טלפון":"054-2384987","אימייל":"haran2104@gmail.com"},
  {"שם מלא":"חיים מזר ","כלי":"טובה","טלפון":"054-4686977","אימייל":"haim_mazar@hotmail.com"},
  {"שם מלא":"עודד מאיר ","כלי":"טרומבון ","טלפון":"052-6-899189","אימייל":"meiroded@gmail.com"},
  {"שם מלא":"ליאת ניסן","כלי":"מקהלה","טלפון":"054-2881116","אימייל":"liatnise@gmail.com"},
  {"שם מלא":"נטלי נקש","כלי":"פסנתר","טלפון":"054-5323052","אימייל":"Nathalie.seror@gmail.com"},
  {"שם מלא":"זינה סוחובוק ","כלי":"נבל","טלפון":"054-4470676","אימייל":"zina20@gmail.com"},
  {"שם מלא":"בוריס סולומוניק ","כלי":"חליל צד","טלפון":"054-7879719","אימייל":"bsolomonik@gmail.com"},
  {"שם מלא":"מרינה ספקטור","כלי":"מלווה פסנתר","טלפון":"050-4217605","אימייל":"spektormarina3@gmail.com"},
  {"שם מלא":"תומר עמרני","כלי":"חליל צד","טלפון":"054-2152420","אימייל":"amrani.t@gmail.com"},
  {"שם מלא":"גבריאל פוטז'ניק","כלי":"פיתוח קול","טלפון":"054-9543672","אימייל":"gabrielpotaznik7@gmail.com"},
  {"שם מלא":"נטלי פורמן ","כלי":"כנור","טלפון":"050-8680018","אימייל":"fnatalli24@gmail.com"},
  {"שם מלא":"אלסיה פלדמן ","כלי":"צ'לו","טלפון":"054-4790175","אימייל":"skrabatunalesya@gmail.com"},
  {"שם מלא":"גיא פורת ","כלי":"מנצח , מנהל תכנית תלמים ","טלפון":"054-4-697472","אימייל":"guy@poratguy.com "},
  {"שם מלא":"צביקה פלסר","כלי":"צ'לו","טלפון":"054-4274884","אימייל":"zviplesser@gmail.com"},
  {"שם מלא":"עמית פרידמן","כלי":"תלמים ","טלפון":"052-3327634","אימייל":" amitamitf@gmail.com"},
  {"שם מלא":"רפאל פריימן ","כלי":"תופים","טלפון":"052-6386235","אימייל":" fraiman89@gmail.com"},
  {"שם מלא":"אלונה קוטליאר  ","כלי":"כינור","טלפון":"054-5-997257","אימייל":"alonakotlyar70@gmail.com"},
  {"שם מלא":"אחינועם קייסר ","כלי":"מלווה\/ מורה לפסנתר","טלפון":"052-6571777","אימייל":" achikeis@gmail.com"},
  {"שם מלא":"ורד קריימן","כלי":"סקסופון","טלפון":"052-7569642","אימייל":"veredk16@gmail.com"},
  {"שם מלא":"רז קרוגמן ","כלי":"גיטרה","טלפון":"052-8-618640","אימייל":"razkrugman@gmail.com"},
  {"שם מלא":"מאיה רגב ","כלי":"כינור דקל ","טלפון":"052-2071611","אימייל":"zoharaevenaddviolin@gmail.com"},
  {"שם מלא":"יובל רז","כלי":"גיטרה בס \/מגמה","טלפון":"054-7986279","אימייל":"yuvalraz16@gmail.com> "},
  {"שם מלא":"לובה רבין","כלי":"צלו","טלפון":"054-7655245","אימייל":"lubarabin@gmail.com"},
  {"שם מלא":"מיכל רהט ","כלי":"תופים","טלפון":"052-2-213983","אימייל":"shark29@gmail.com"},
  {"שם מלא":"אינה רובין ","כלי":"פסנתר","טלפון":"052-8-670446","אימייל":"rubininna@gmail.com"},
  {"שם מלא":"ליאת רוקברגר","כלי":"פיתוח קול","טלפון":"050-2116197","אימייל":"liatmorduch@yahoo.com"},
  {"שם מלא":"ברק שרובסקי ","כלי":"גיטרה","טלפון":"054-7337127","אימייל":"baraksh12@gmail.com"},
  {"שם מלא":"אורית שוורצנברג","כלי":"קלרינט","טלפון":"052-4636356","אימייל":"oritswrz@gmail.com"},
  {"שם מלא":"דרור שביד","כלי":"תיאוריה בתלמים","טלפון":"055-2223573","אימייל":"drorsc19@gmail.com"},
  {"שם מלא":"ענת שפירא ","כלי":"פסנתר","טלפון":"054-6-577557","אימייל":"Anatlewy@gmail.com"},
  {"שם מלא":"אלה תדמור ","כלי":"פיתוח קול ","טלפון":"052-3288884","אימייל":"tadmorella@yahoo.com"},
  {"שם מלא":"יבגני בושקוב","כלי":"מנצח ","טלפון":null,"אימייל":"evgbush@gmail.com"},
  {"שם מלא":"נטליה גנקינה ","כלי":"כינור","טלפון":"050-8840497","אימייל":"nataliagenkina03@gmail.com"},
  {"שם מלא":"ואדים זלייב","כלי":"כלי הקשה","טלפון":"054-5370713","אימייל":"vadim2707@gmail.com"},
  {"שם מלא":"רותי חלבני ","כלי":"שירה","טלפון":"054-2-098228","אימייל":"songbird0001@gmail.com"},
  {"שם מלא":"ענת טיברגר ","כלי":"חליל","טלפון":"054-3-090412","אימייל":"anattbbu@gmail.com"},
  {"שם מלא":" בן לביא","כלי":"גיטרה","טלפון":" 054-5774984","אימייל":"labiben@gmail.com"},
  {"שם מלא":"אבי ליבוביץ'","כלי":"ג'אז","טלפון":"054-5227077","אימייל":"avilebovich@gmail.co"},
  {"שם מלא":"טל סגרון","כלי":"תופים","טלפון":"052-4304144","אימייל":"sagrontal@gmail.com"},
  {"שם מלא":"גיל פקר  ","כלי":"פסנתר","טלפון":"050-8-377597","אימייל":"Plasterina@gmail.com"},
  {"שם מלא":"ולדימיר צ`רפובצקי ","כלי":null,"טלפון":"050-2648741","אימייל":" vcherepovsky@gmail.com"},
  {"שם מלא":"מריה קובזרבה","כלי":"כינור","טלפון":"053-4258532","אימייל":"kobzarevamaria120@gmail.com"},
  {"שם מלא":"יעל קראוס","כלי":"פיתוח קול","טלפון":"050-8880969","אימייל":"yaelkraus@gmail.com"},
  {"שם מלא":"יובל אבני ","כלי":"טובה","טלפון":"052-8559953","אימייל":"yuval.avni11@gmail.com"},
  {"שם מלא":"נועם  בוכריס","כלי":"תלמים ","טלפון":"052-595-2810","אימייל":"Noamboukris1@gmail.com"},
  {"שם מלא":"דניאלה ברקוביץ","כלי":"חליל צד","טלפון":"052-4245770","אימייל":"dgny7@walla.com"},
  {"שם מלא":"סי גיי גלס ","כלי":"תאוריה","טלפון":"058-6990501","אימייל":"cglass1@gmail.com"},
  {"שם מלא":"אריאל הלוי","כלי":"פסנתר","טלפון":"050-8619959","אימייל":"Arielhalevy@yahoo.com"},
  {"שם מלא":"אור סויסה ","כלי":"גיטרה","טלפון":"050-6764065","אימייל":"orsuissa@gmail.com"},
  {"שם מלא":"לריסה פרידמן","כלי":"פסנתר","טלפון":"054-5209913","אימייל":"umolara@gmail.com"},
  {"שם מלא":"עדי ברקובסקי ","כלי":"חלילית","טלפון":"054-4447032","אימייל":"adi.bercowski@gmail.com"}
].filter(teacher => 
  teacher["שם מלא"] && 
  teacher["שם מלא"] !== "nan nan" && 
  teacher["אימייל"] && 
  teacher["אימייל"] !== null
);

// Load full students data from external files
import fs from 'fs';
import path from 'path';

// Read and parse the full students JSON file
const studentsFilePath = '/mnt/c/Users/yona2/Desktop/מרכז מוסיקה מידע לאפליקציה/Students.json';
let allStudents = [];

try {
  const studentsData = fs.readFileSync(studentsFilePath, 'utf8');
  const rawStudents = JSON.parse(studentsData);
  
  // Filter out invalid entries and clean data
  allStudents = rawStudents.filter(student => 
    student["שם התלמיד"] && 
    student["שם התלמיד"].trim() !== "" &&
    student["גיל"] !== undefined &&
    student["גיל"] !== null
  ).map(student => ({
    ...student,
    // Clean age data - fix unrealistic ages
    "גיל": (student["גיל"] && student["גיל"] < 100) ? student["גיל"] : null,
    // Clean phone numbers
    "טלפון": student["טלפון"] ? student["טלפון"].toString().replace(/^0/, '').replace(/[^\d]/g, '') : "",
    // Clean email
    "דואל": student["דואל"] || ""
  }));
  
  console.log(`📚 Loaded ${allStudents.length} students from JSON file`);
} catch (error) {
  console.error('❌ Error reading students file:', error.message);
  console.log('📝 Using fallback sample data...');
  
  // Fallback to sample data if file can't be read
  allStudents = [
    {"כלי": "אבוב","שם המורה": "מורה אחר","משך שיעור": "שיעור 60 דק","שם הורה": "האס סינטיה שרה","שם התלמיד": "האס גרמי","טלפון": "0537082807","כתובת": "רחוב: בר אילן בית: 26 דירה: 7, רעננה","גיל": 12,"דואל": "cynthiasarahaas@gmail.com"},
    {"כלי": "בסון","שם המורה": "מזור דמיטרי","משך שיעור": "שיעור 45 דק","שם הורה": "וינברגר בהיר קלודין","שם התלמיד": "בהיר עלמה","טלפון": "0522516282","כתובת": "רחוב: התחיה בית: 3 דירה: 8, רעננה","גיל": 14,"דואל": "claudinw@gmail.com"},
    {"כלי": "חלילית","שם המורה": "אורית שוורצנברג","משך שיעור": "שיעור 30 דק","שם הורה": "פטאל פנינה","שם התלמיד": "פטאל פנינה","טלפון": "0545779687","כתובת": "רחוב: המעפילים בית: 3 דירה: 6, רעננה","גיל": 74,"דואל": "pninaer@walla.com"},
    {"כלי": "חלילית","שם המורה": "מורה אחר","משך שיעור": "שיעור 45 דק","שם הורה": "ששון ערן","שם התלמיד": "ששון אגת","טלפון": "0526259134","כתובת": "דר יהודה פרח 12, נתניה","גיל": 8,"דואל": "eransasson2019@gmail.com"},
    {"כלי": "חלילית","שם המורה": "מורה אחר","משך שיעור": "שיעור 45 דק","שם הורה": "קרשנר עדי","שם התלמיד": "קרשנר מיה","טלפון": "0506666364","כתובת": "רחוב: הר סיני בית: 35 דירה: 4 4, רעננה","גיל": 8,"דואל": "adigat2@gmail.com"}
  ];
}

async function createTeacherDocument(teacherData) {
  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const now = new Date();
  
  return {
    personalInfo: {
      fullName: teacherData["שם מלא"].trim(),
      phone: teacherData["טלפון"] || "",
      email: teacherData["אימייל"].toLowerCase().trim(),
      address: "" // Leave empty for later update
    },
    roles: ["מורה"], // Simple role as requested
    professionalInfo: {
      instrument: teacherData["כלי"] || "",
      isActive: true
    },
    teaching: {
      studentIds: [],
      schedule: [],
      timeBlocks: []
    },
    conducting: {
      orchestraIds: []
    },
    ensemblesIds: [],
    schoolYears: [],
    credentials: {
      email: teacherData["אימייל"].toLowerCase().trim(),
      password: hashedPassword,
      invitationToken: null,
      invitationExpiry: null,
      isInvitationAccepted: true,
      tokenVersion: 1,
      refreshToken: null,
      resetToken: null,
      resetTokenExpiry: null,
      requiresPasswordChange: true,
      passwordSetAt: now,
      lastLogin: null,
      invitedAt: now,
      invitedBy: "bulk_import",
      invitationMode: "DEFAULT_PASSWORD"
    },
    isActive: true,
    createdAt: now,
    updatedAt: now
  };
}

async function createStudentDocument(studentData) {
  const now = new Date();
  
  return {
    personalInfo: {
      fullName: studentData["שם התלמיד"].trim(),
      phone: studentData["טלפון"] || "",
      age: studentData["גיל"] && studentData["גיל"] < 100 ? studentData["גיל"] : null,
      address: studentData["כתובת"] || "",
      parentName: studentData["שם הורה"] || "",
      parentPhone: studentData["טלפון"] || "",
      parentEmail: studentData["דואל"] || "",
      studentEmail: "" // Leave empty for now
    },
    academicInfo: {
      instrumentProgress: [{
        instrumentName: studentData["כלי"] || "",
        isPrimary: true,
        currentStage: 1,
        tests: {
          stageTest: {
            status: "לא נבחן",
            lastTestDate: null,
            nextTestDate: null,
            notes: ""
          },
          technicalTest: {
            status: "לא נבחן",
            lastTestDate: null,
            nextTestDate: null,
            notes: ""
          }
        }
      }],
      class: "" // Leave empty for later update
    },
    enrollments: {
      orchestraIds: [],
      ensembleIds: [],
      theoryLessonIds: [],
      schoolYears: []
    },
    teacherIds: [], // Legacy compatibility
    teacherAssignments: [],
    isActive: true,
    createdAt: now,
    updatedAt: now
  };
}

async function bulkInsertData() {
  let client;
  
  try {
    console.log('🚀 Starting bulk data insertion...');
    
    // Connect to MongoDB
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db(MONGODB_NAME);
    const teachersCollection = db.collection('teacher');
    const studentsCollection = db.collection('student');
    
    console.log('\n📚 Processing Teachers...');
    
    // Check for existing teachers by email to avoid duplicates
    const existingTeacherEmails = await teachersCollection
      .find({}, { projection: { 'personalInfo.email': 1 } })
      .toArray();
    const existingEmails = new Set(existingTeacherEmails.map(t => t.personalInfo?.email));
    
    const teachersToInsert = [];
    const skippedTeachers = [];
    
    for (const teacherData of allTeachers) {
      const email = teacherData["אימייל"].toLowerCase().trim();
      
      if (existingEmails.has(email)) {
        skippedTeachers.push({ email, name: teacherData["שם מלא"] });
        console.log(`⚠️  Skipping teacher ${teacherData["שם מלא"]} - email already exists`);
      } else {
        const teacherDoc = await createTeacherDocument(teacherData);
        teachersToInsert.push(teacherDoc);
        console.log(`✅ Prepared teacher: ${teacherData["שם מלא"]}`);
      }
    }
    
    // Insert teachers
    let insertedTeachers = [];
    if (teachersToInsert.length > 0) {
      const teacherResult = await teachersCollection.insertMany(teachersToInsert);
      insertedTeachers = teacherResult.insertedIds;
      console.log(`✅ Inserted ${teacherResult.insertedCount} teachers`);
    } else {
      console.log('ℹ️  No new teachers to insert');
    }
    
    console.log('\n👨‍🎓 Processing Students...');
    
    // Check for existing students by name+parent email to avoid duplicates
    const existingStudents = await studentsCollection
      .find({}, { projection: { 'personalInfo.fullName': 1, 'personalInfo.parentEmail': 1 } })
      .toArray();
    const existingStudentKeys = new Set(
      existingStudents.map(s => 
        `${s.personalInfo?.fullName}-${s.personalInfo?.parentEmail}`.toLowerCase()
      )
    );
    
    const studentsToInsert = [];
    const skippedStudents = [];
    
    for (const studentData of allStudents) {
      const studentKey = `${studentData["שם התלמיד"]}-${studentData["דואל"] || ""}`.toLowerCase();
      
      if (existingStudentKeys.has(studentKey)) {
        skippedStudents.push({ name: studentData["שם התלמיד"], parent: studentData["שם הורה"] });
        console.log(`⚠️  Skipping student ${studentData["שם התלמיד"]} - already exists`);
      } else {
        const studentDoc = await createStudentDocument(studentData);
        studentsToInsert.push(studentDoc);
        console.log(`✅ Prepared student: ${studentData["שם התלמיד"]}`);
      }
    }
    
    // Insert students
    let insertedStudents = [];
    if (studentsToInsert.length > 0) {
      const studentResult = await studentsCollection.insertMany(studentsToInsert);
      insertedStudents = studentResult.insertedIds;
      console.log(`✅ Inserted ${studentResult.insertedCount} students`);
    } else {
      console.log('ℹ️  No new students to insert');
    }
    
    // Summary
    console.log('\n📊 BULK INSERT SUMMARY');
    console.log('========================');
    console.log(`Teachers inserted: ${Object.keys(insertedTeachers).length}`);
    console.log(`Teachers skipped: ${skippedTeachers.length}`);
    console.log(`Students inserted: ${Object.keys(insertedStudents).length}`);
    console.log(`Students skipped: ${skippedStudents.length}`);
    
    if (skippedTeachers.length > 0) {
      console.log('\n⚠️  Skipped Teachers:');
      skippedTeachers.forEach(t => console.log(`   - ${t.name} (${t.email})`));
    }
    
    if (skippedStudents.length > 0) {
      console.log('\n⚠️  Skipped Students:');
      skippedStudents.forEach(s => console.log(`   - ${s.name} (parent: ${s.parent})`));
    }
    
    console.log('\n🎉 Bulk insertion completed successfully!');
    console.log(`💡 Default password for all teachers: "${DEFAULT_PASSWORD}"`);
    console.log('💡 Teachers will be required to change password on first login');
    
  } catch (error) {
    console.error('❌ Error during bulk insertion:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  bulkInsertData()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

export { bulkInsertData, allTeachers, allStudents };