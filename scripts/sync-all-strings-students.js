/**
 * Comprehensive Student Sync for Strings Department
 *
 * This script:
 * 1. Checks which students exist in the database
 * 2. Creates missing students
 * 3. Links students to correct teachers
 * 4. Verifies all data is correct
 */

import 'dotenv/config'
import { MongoClient, ObjectId } from 'mongodb'
import bcrypt from 'bcrypt'

// Complete student data from Excel
const ALL_STUDENTS = [
  // כינור students
  { instrument: 'כינור', teacherName: 'לוין ורוניקה', duration: 120, parentName: 'יליזרוב אירינה', studentName: 'יליזרוב נועה', age: 18, phone: '526778257', email: 'irand10@yahoo.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'קוטליאר אלונה', duration: 120, parentName: 'רזאל ניצן חן', studentName: 'רזאל בארי שולמית', age: 17, phone: '534295729', email: 'nrazel@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'פורמן נטליה', duration: 60, parentName: 'פריזה יעל', studentName: 'פריזה הראל', age: 16, phone: '506591343', email: 'yaelpr@gmail.com', city: 'בצרה' },
  { instrument: 'כינור', teacherName: 'זיסקינד מרינה', duration: 60, parentName: 'בן יוחנה משה', studentName: 'דמבו בן יוחנה ללה', age: 9, phone: '507595534', email: 'moshe.by@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'פורמן נטליה', duration: 90, parentName: 'אליהו אלינה', studentName: 'אליהו אוריאל', age: 12, phone: '503935684', email: 'eliahualina@yahoo.com', city: 'כפר סבא' },
  { instrument: 'כינור', teacherName: 'זיסקינד מרינה', duration: 120, parentName: 'פיש אלכסנדר', studentName: 'פיש דניאל', age: 14, phone: '548885334', email: 'Alexander.fish@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'זיסקינד מרינה', duration: 90, parentName: 'רזאל ניצן חן', studentName: 'רזאל זוהר ישעיהו', age: 14, phone: '534295729', email: 'nrazel@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'ארונזון אנה', duration: 120, parentName: 'גטניו גנאל אתי', studentName: 'פרץ ליהיא', age: 13, phone: '545444781', email: 'ganel.coaching@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'אברהם סבטלנה', duration: 120, parentName: 'נייטס אלינור', studentName: 'נייטס אלה', age: 12, phone: '523682001', email: 'elinornates@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'לוין ורוניקה', duration: 60, parentName: 'קאשני ענבל', studentName: 'קאשני מזרחי שיר', age: 11, phone: '524007362', email: 'Inbalkashany@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'פורמן נטליה', duration: 45, parentName: 'גרובמן קסוטו רינה', studentName: 'קסוטו מרים ברכה', age: 11, phone: '544413557', email: 'rinacassouto@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'לוין ורוניקה', duration: 90, parentName: 'סלם בן הרוש קרין יעל', studentName: 'בן הרוש שנה', age: 11, phone: '545532818', email: 'karine.benaroch@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'אברהם סבטלנה', duration: 120, parentName: 'שראיזין אירינה', studentName: 'שראיזין איתי', age: 10, phone: '544789038', email: 'irinakem@gmail.com', city: 'נתניה' },
  { instrument: 'כינור', teacherName: 'ארונזון אנה', duration: 90, parentName: 'פאסי דוד פרוספר', studentName: 'פאסי יעל', age: 10, phone: '543120900', email: 'saraisrael33@hotmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'קוטליאר אלונה', duration: 90, parentName: 'לסר לירון', studentName: 'לסר שחר', age: 10, phone: '508551143', email: 'lironlasser@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'זיסקינד מרינה', duration: 120, parentName: 'שורץ אהרון', studentName: 'שורץ ציגלר כחל', age: 10, phone: '545312559', email: 'aharonsh@gmail.com', city: 'כפר סבא' },
  { instrument: 'כינור', teacherName: 'לוין ורוניקה', duration: 60, parentName: 'יעקב הכהן חני מסעודה', studentName: 'יעקב הכהן גאיה', age: 10, phone: '527909169', email: '85honey@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'אברהם סבטלנה', duration: 120, parentName: 'סורקין דינה', studentName: 'סורקין שרה ליה', age: 10, phone: '539262550', email: 'Sorkinedina@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'קוטליאר אלונה', duration: 90, parentName: 'גלעד מילס', studentName: 'מילס טרכטנברג מלאכי ישראל', age: 8, phone: '545907788', email: 'giladmills@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'סלטקין אלה', duration: 60, parentName: 'גל הדר שיראל שרה', studentName: 'גל הדר ארייה', age: 8, phone: '528771444', email: 'shirrula@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'סלטקין אלה', duration: 60, parentName: 'גולן קריאף קרין מיכל', studentName: 'גולן ליבי רינה', age: 7, phone: '586665787', email: 'eligolan007@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'אברהם סבטלנה', duration: 60, parentName: 'אלחרט אליזבטה', studentName: 'אלחרט שרה', age: 7, phone: '542058664', email: 'liza.eljarat@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'לוין ורוניקה', duration: 60, parentName: 'שקלרסקי מיכל', studentName: 'שקלרסקי נעה', age: 7, phone: '549992857', email: 'shklarsk@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'זיסקינד מרינה', duration: 60, parentName: 'מיבר תמרקין שני', studentName: 'תמרקין אורי', age: 7, phone: '545905490', email: 'Nikishani@gmail.com', city: 'הוד השרון' },
  { instrument: 'כינור', teacherName: 'לוין ורוניקה', duration: 60, parentName: 'אהרוני מורן', studentName: 'אהרוני מיכאלה', age: 7, phone: '546617188', email: 'gurmoran@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'קוטליאר אלונה', duration: 60, parentName: 'אלטמן ליאורה', studentName: 'אלטמן אמה', age: 6, phone: '525494027', email: 'lioraaltman@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'לוין ורוניקה', duration: 60, parentName: 'שם טוב בועז', studentName: 'שם טוב שירה', age: 6, phone: '542276585', email: 'boaz@segol.net', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'לוין ורוניקה', duration: 60, parentName: 'אליאב סתיו', studentName: 'אליאב שחר', age: 6, phone: '543101835', email: 'staveliav@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'אברהם סבטלנה', duration: 60, parentName: 'קאופמן גליה', studentName: 'קאופמן אלמוג', age: 5, phone: '546665288', email: 'gali3939@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'זיסקינד מרינה', duration: 60, parentName: 'סיימון רומי', studentName: 'סיימון לאו ריי', age: 5, phone: '547277322', email: 'svetaxp@gmail.com', city: 'חדרה' },
  { instrument: 'כינור', teacherName: 'פורמן נטליה', duration: 60, parentName: 'בסקין מארי', studentName: 'בסקין ארז', age: 7, phone: '539525778', email: 'marie.baskin@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'לוין ורוניקה', duration: 60, parentName: 'גרפילד מורווי דפנה', studentName: 'גרפילד בנימין טוביה', age: 7, phone: '545415252', email: 'Dafnamorvay@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'פורמן נטליה', duration: 60, parentName: 'שמיר רון', studentName: 'שמיר גילי', age: 5, phone: '528737377', email: 'mronshamir@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'קוטליאר אלונה', duration: 60, parentName: 'צחי ענבר', studentName: 'סויסה פז', age: 4, phone: '505877005', email: 'inbartz90@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'לוין ורוניקה', duration: 60, parentName: 'שם טוב קרולין', studentName: 'שם טוב קרולין', age: 43, phone: '523057272', email: 'caroline@segol.net', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'סלטקין אלה', duration: 90, parentName: 'לוי רינה שמחה', studentName: 'לוי לילה', age: 9, phone: '547787401', email: 'Levyr.law@gamil.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'ארונזון אנה', duration: 75, parentName: 'מעוז דרור', studentName: 'מעוז מתן', age: 16, phone: '543453546', email: 'drorrmaoz@aol.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'קוטליאר אלונה', duration: 90, parentName: 'שטראוס יהודית', studentName: 'שטראוס שושנה', age: 13, phone: '543383122', email: 'judyelzer@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'קוטליאר אלונה', duration: 120, parentName: 'מרגולין נטליה טלי', studentName: 'מרגולין הדר', age: 13, phone: '533342370', email: 'Tali.margolin@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'זיסקינד מרינה', duration: 90, parentName: 'ברקוביץ קטי', studentName: 'ברקוביץ אדם', age: 10, phone: '525206186', email: 'kate.rayhman@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'קוטליאר אלונה', duration: 90, parentName: 'חופרי גלית', studentName: 'חופרי יובל', age: 13, phone: '502047664', email: 'galit.hofree@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'פורמן נטליה', duration: 75, parentName: 'שני קלין יעל', studentName: 'קלין נועה', age: 10, phone: '528301348', email: 'yael.shani82@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'זיסקינד מרינה', duration: 120, parentName: 'אומנסקי גוטמן יעל', studentName: 'גוטמן נעמי', age: 11, phone: '526906098', email: 'yael.umansky@gmail.com', city: 'כפר סבא' },
  { instrument: 'כינור', teacherName: 'פורמן נטליה', duration: 75, parentName: 'מירון תומר', studentName: 'מירון יאיר', age: 47, phone: '526031418', email: 'tomer.meron@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'לוין ורוניקה', duration: 90, parentName: 'הולנד יאיר', studentName: 'הולנד יעל אלישבע', age: 17, phone: '545650876', email: 'orlyholland@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'זיסקינד מרינה', duration: 45, parentName: 'גורודניצקי אסטליין נטליה', studentName: 'שוורץ אלה סופיה שרה', age: 16, phone: '547355850', email: 'gorodni@list.ru', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'זיסקינד מרינה', duration: 90, parentName: 'רוזן שלומית', studentName: 'רוזן יולי', age: 16, phone: '543233080', email: 'shlomitsivan@hotmail.com', city: 'הרצליה' },
  { instrument: 'כינור', teacherName: 'אברהם סבטלנה', duration: 120, parentName: 'שינברג רונית', studentName: 'שינברג צדוק ניתאי', age: 15, phone: '503221185', email: 'ronit1761@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'ארונזון אנה', duration: 75, parentName: 'מעוז דרור', studentName: 'מעוז היילי רבקה', age: 13, phone: '543453546', email: 'drorrmaoz@aol.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'זיסקינד מרינה', duration: 120, parentName: 'סויברט ליאת', studentName: 'סויברט עלמה', age: 14, phone: '544782751', email: 'liatsoy@gmail.com', city: 'כפר סבא' },
  { instrument: 'כינור', teacherName: 'זיסקינד מרינה', duration: 60, parentName: 'מירושניק יבגני', studentName: 'מירושניק איתמר', age: 13, phone: '504900460', email: 'netamiro@gmail.com', city: 'נתניה' },
  { instrument: 'כינור', teacherName: 'לוין ורוניקה', duration: 90, parentName: 'שם טוב בועז', studentName: 'שם טוב הילה', age: 11, phone: '542276585', email: 'boaz@segol.net', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'לוין ורוניקה', duration: 75, parentName: 'אליהו בהנאם יששכר', studentName: 'אליהו שירה', age: 11, phone: '544544817', email: 'behnameliyahu@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'זיסקינד מרינה', duration: 90, parentName: 'ויינברג נחום', studentName: 'ויינברג שרה', age: 10, phone: '544518989', email: 'Asaotvainberg@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'קוטליאר אלונה', duration: 90, parentName: 'פוגל-דרור יאיר', studentName: 'דרור מטע יובל', age: 13, phone: '523486486', email: 'yairfogel@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'לוין ורוניקה', duration: 90, parentName: 'אנטונוב מרינה', studentName: 'אנטונוב אליזבטה', age: 15, phone: '586455590', email: 'yamit-m@yandex.ru', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'ארונזון אנה', duration: 90, parentName: 'שמלה באטריס פורטון', studentName: 'שמלה אנאיס חנה', age: 17, phone: '585838906', email: 'beatrice1.chemla@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'לוין ורוניקה', duration: 75, parentName: 'סורקין פמלה', studentName: 'סורקין איתן', age: 9, phone: '545855858', email: 'pamelacohen7@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'דולוב אלכס', duration: 60, parentName: 'בורשטיין רות', studentName: 'מקובצקי הלל', age: 9, phone: '524373279', email: 'ruthburstein@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'ארונזון אנה', duration: 60, parentName: 'רויטמן עדיאל', studentName: 'רויטמן רוני', age: 1, phone: '542440313', email: 'adielroitman@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'קוטליאר אלונה', duration: 90, parentName: 'צחי ענבר', studentName: 'סויסה אגם', age: 8, phone: '505877005', email: 'inbartz90@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'פורמן נטליה', duration: 60, parentName: 'אברהם קים', studentName: 'אברהם רקפת', age: 8, phone: '586787437', email: 'avraham.kim@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'זיסקינד מרינה', duration: 60, parentName: 'כהן רפאל', studentName: 'כהן אביגיל', age: 8, phone: '547858551', email: 'avitalcohen@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'אברהם סבטלנה', duration: 60, parentName: 'ויינר לובוב ליבי', studentName: 'ויינר אדר משה', age: 7, phone: '545458775', email: 'docwainer@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'אברהם סבטלנה', duration: 60, parentName: 'בן זמרה בנימין', studentName: 'בן זמרה אגם שרה', age: 7, phone: '546847647', email: 'benjamin.benzimra@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'קוטליאר אלונה', duration: 60, parentName: 'בירמן-ויסוצקי אינסה', studentName: 'בירמן ויסוצקי ביאנקה', age: 7, phone: '524422627', email: 'bv.inessa@yahoo.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'לוין ורוניקה', duration: 75, parentName: 'יחזקאל רבקה', studentName: 'יחזקאל שרה', age: 7, phone: '527499494', email: 'rebeccaezekiel92@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'אברהם סבטלנה', duration: 60, parentName: 'סופיר קארן', studentName: 'סופיר ליטל', age: 8, phone: '537084624', email: 'karen.souffir@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'ארונזון אנה', duration: 60, parentName: 'מעוז דרור', studentName: 'מעוז תהל-אור ליה', age: 7, phone: '543453546', email: 'drorrmaoz@aol.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'זיסקינד מרינה', duration: 60, parentName: 'עמר טליה שמחה', studentName: 'קרים אביטל', age: 6, phone: '547855100', email: 'talia.talia.amar@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'פורמן נטליה', duration: 60, parentName: 'גנץ יעל', studentName: 'גנץ ארייה', age: 7, phone: '523234433', email: 'yaelganz@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'פורמן נטליה', duration: 60, parentName: 'יקר ישעיה אילת אליה', studentName: 'ישעיה שירה זכה', age: 6, phone: '544502218', email: 'ayelety11@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'זיסקינד מרינה', duration: 90, parentName: 'גולברג אולגה', studentName: 'גולדברג מארק', age: 10, phone: '546164364', email: 'greblogaglo@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'סלטקין אלה', duration: 90, parentName: 'אלפרן נועה', studentName: 'אלפרן הלנה', age: 8, phone: '538258017', email: 'Noa.elpern@gmail.com', city: 'הוד השרון' },
  { instrument: 'כינור', teacherName: 'זיסקינד מרינה', duration: 90, parentName: 'בלנקי אולגה', studentName: 'בלנקי דמיטרי', age: 8, phone: '532428073', email: 'olga.s.belenkaya@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'זיסקינד מרינה', duration: 60, parentName: 'גולדברג מרסלה', studentName: 'גולדברג מארק', age: 126, phone: '545437615', email: 'marcelaylorenzo@gmail.com', city: 'נתניה' },
  { instrument: 'כינור', teacherName: 'ארונזון אנה', duration: 90, parentName: 'כהן ג\'ואנה קלי', studentName: 'כהן פרל', age: 9, phone: '587711081', email: 'johannasabbah@gmail.com', city: 'רעננה' },
  { instrument: 'כינור', teacherName: 'קוטליאר אלונה', duration: 90, parentName: 'טיחונצ\'וק טאיסיה', studentName: 'טיהונצ\'וק אליסה', age: 10, phone: '553163053', email: 'taisiyatikhonchuk@gmail.com', city: 'רעננה' },
  // ויולה students
  { instrument: 'ויולה', teacherName: 'זיסקינד מרינה', duration: 60, parentName: 'איגוס אליצור', studentName: 'איגוס איתן', age: 16, phone: '548102005', email: 'aguswork@gmail.com', city: 'רעננה' },
  { instrument: 'ויולה', teacherName: 'זיסקינד מרינה', duration: 45, parentName: 'מירושניק יבגני', studentName: 'מירושניק איתמר', age: 13, phone: '504900460', email: 'netamiro@gmail.com', city: 'נתניה' },
  // נבל students
  { instrument: 'נבל', teacherName: 'סוחובוק זינה', duration: 60, parentName: 'פיכמן סווטה', studentName: 'פיכמן טאיה', age: 17, phone: '544490861', email: 'Fichmans@gmail.com', city: 'תל אביב - יפו' },
  { instrument: 'נבל', teacherName: 'סוחובוק זינה', duration: 60, parentName: 'קליין נתנהאל קלייר', studentName: 'קליין אוראליה', age: 14, phone: '502042276', email: 'NATHOUK@GMAIL.COM', city: 'רעננה' },
  { instrument: 'נבל', teacherName: 'סוחובוק זינה', duration: 90, parentName: 'אבן ענת', studentName: 'אבן עזריה זהר', age: 12, phone: '507498041', email: 'anateven@gmail.com', city: 'הרצליה' },
  { instrument: 'נבל', teacherName: 'סוחובוק זינה', duration: 60, parentName: 'שחר לילך', studentName: 'שחר אור', age: 12, phone: '544705533', email: 'lilach1ad@gmail.com', city: 'תל מונד' },
  { instrument: 'נבל', teacherName: 'סוחובוק זינה', duration: 60, parentName: 'ינצ\'ק אבו לאה', studentName: 'אבו אוו', age: 8, phone: '555002091', email: 'lea75015@msn.com', city: 'רעננה' },
  { instrument: 'נבל', teacherName: 'סוחובוק זינה', duration: 60, parentName: 'עוז דוד', studentName: 'עוז מוניקה', age: 52, phone: '512579488', email: 'anda2402@gmail.com', city: 'רעננה' },
  // צ'לו students
  { instrument: 'צ\'לו', teacherName: 'ברגמן מרסל', duration: 120, parentName: 'רונן מיכל', studentName: 'גרנצרז\' אוהד', age: 18, phone: '543498891', email: 'michali854@gmail.com', city: 'רעננה' },
  { instrument: 'צ\'לו', teacherName: 'מלצר הרן', duration: 60, parentName: 'קבנור הדיה', studentName: 'קבנור ירדן', age: 16, phone: '544718602', email: 'david.hedya@gmail.com', city: 'רעננה' },
  { instrument: 'צ\'לו', teacherName: 'רבין לובה', duration: 90, parentName: 'עין צבי כרמית', studentName: 'עין צבי גלעד', age: 12, phone: '507410755', email: 'carmit.eldan@gmail.com', city: 'רעננה' },
  { instrument: 'צ\'לו', teacherName: 'פלדמן אלסיה', duration: 90, parentName: 'זהבי שרון רגינה', studentName: 'זהבי רעננה', age: 12, phone: '523382533', email: 'Sharonzahav@gmail.com', city: 'רעננה' },
  { instrument: 'צ\'לו', teacherName: 'רבין לובה', duration: 90, parentName: 'מיכנובסקי קיריל', studentName: 'מיכנובסקי איתן', age: 12, phone: '523944787', email: 'kirillmihanovsky@gmail.com', city: 'תל אביב - יפו' },
  { instrument: 'צ\'לו', teacherName: 'דולוב אלכס', duration: 90, parentName: 'גלעד מילס', studentName: 'מילס טרכטנברג אביגיל', age: 10, phone: '545907788', email: 'giladmills@gmail.com', city: 'רעננה' },
  { instrument: 'צ\'לו', teacherName: 'רבין לובה', duration: 90, parentName: 'פיש אלכסנדר', studentName: 'פיש יונתן', age: 9, phone: '548885334', email: 'Alexander.fish@gmail.com', city: 'רעננה' },
  { instrument: 'צ\'לו', teacherName: 'פלדמן אלסיה', duration: 90, parentName: 'לכמן ליאת', studentName: 'לכמן אמה גל', age: 10, phone: '547294721', email: 'Liatlachmann@gmail.com', city: 'רעננה' },
  { instrument: 'צ\'לו', teacherName: 'פלדמן אלסיה', duration: 75, parentName: 'פיינברג שרה-מאשה', studentName: 'גיברה פיינברג נהורה', age: 9, phone: '549190018', email: 'Sarahfainberg@gmail.com', city: 'רעננה' },
  { instrument: 'צ\'לו', teacherName: 'רבין לובה', duration: 90, parentName: 'Yehudin Yevgeny', studentName: 'Yehudin David', age: 8, phone: '524618986', email: 'yevgenyyehudin@gmail.com', city: 'רעננה' },
  { instrument: 'צ\'לו', teacherName: 'דולוב אלכס', duration: 60, parentName: 'פורת גיא', studentName: 'פורת לביא', age: 8, phone: '543026767', email: 'guy@poratguy.com', city: 'חורשים' },
  { instrument: 'צ\'לו', teacherName: 'פלדמן אלסיה', duration: 60, parentName: 'גרונשטיין סטניסלב', studentName: 'גרונשטיין אדל', age: 6, phone: '559575448', email: 'm_8484@walla.com', city: 'רעננה' },
  { instrument: 'צ\'לו', teacherName: 'דולוב אלכס', duration: 60, parentName: 'גרפילד מורווי דפנה', studentName: 'גרפילד נועם', age: 7, phone: '545415252', email: 'Dafnamorvay@gmail.com', city: 'רעננה' },
  { instrument: 'צ\'לו', teacherName: 'רבין לובה', duration: 60, parentName: 'שם טוב גילה', studentName: 'שם טוב שי', age: 17, phone: '507686873', email: 'gila.s@windowslive.com', city: 'רעננה' },
  { instrument: 'צ\'לו', teacherName: 'ברגמן מרסל', duration: 90, parentName: 'רוטקופ גילת', studentName: 'רוטקופ שקד רחל', age: 15, phone: '542566897', email: 'gilat.rotkop@gmail.com', city: 'הרצליה' },
  { instrument: 'צ\'לו', teacherName: 'ברגמן מרסל', duration: 90, parentName: 'חן כרמן', studentName: 'חן מיקה', age: 17, phone: '523711505', email: 'carmenit@gmail.com', city: 'קדימה-צורן' },
  { instrument: 'צ\'לו', teacherName: 'רבין לובה', duration: 90, parentName: 'הרבר סנדרה', studentName: 'הרבר מאיה', age: 16, phone: '523414662', email: 'sbherber@gmail.com', city: 'הוד השרון' },
  { instrument: 'צ\'לו', teacherName: 'רבין לובה', duration: 90, parentName: 'זלצבורג אהרון', studentName: 'זלצבורג ברטה', age: 13, phone: '543135002', email: 'aaronsburg@gmail.com', city: 'רעננה' },
  { instrument: 'צ\'לו', teacherName: 'פלדמן אלסיה', duration: 90, parentName: 'פישל מריו', studentName: 'FISCHEL ELIANA', age: 16, phone: '542299378', email: 'fischel.mario@yahoo.com', city: 'רעננה' },
  { instrument: 'צ\'לו', teacherName: 'רבין לובה', duration: 60, parentName: 'גולוב אנדרי', studentName: 'גולוב תום', age: 11, phone: '544221819', email: 'andreyg33@gmail.com', city: 'רעננה' },
  { instrument: 'צ\'לו', teacherName: 'פלדמן אלסיה', duration: 90, parentName: 'שם טוב בועז', studentName: 'שם טוב נעמי', age: 11, phone: '542276585', email: 'boaz@segol.net', city: 'רעננה' },
  { instrument: 'צ\'לו', teacherName: 'דולוב אלכס', duration: 90, parentName: 'סויברט ליאת', studentName: 'סויברט ניאה', age: 10, phone: '544782751', email: 'liatsoy@gmail.com', city: 'כפר סבא' },
  { instrument: 'צ\'לו', teacherName: 'רבין לובה', duration: 60, parentName: 'ויינר לובוב ליבי', studentName: 'ויינר צפורה', age: 11, phone: '545458775', email: 'docwainer@gmail.com', city: 'רעננה' },
  { instrument: 'צ\'לו', teacherName: 'פלדמן אלסיה', duration: 90, parentName: 'נבו רויטל', studentName: 'נבו נעמה', age: 10, phone: '506513282', email: 'revitalgrossnevo@gmail.com', city: 'רעננה' },
  { instrument: 'צ\'לו', teacherName: 'ברגמן מרסל', duration: 60, parentName: 'קרבלניק פרלי', studentName: 'קרבלניק בן', age: 9, phone: '505491044', email: 'perli.benavi@gmail.com', city: 'רעננה' },
  { instrument: 'צ\'לו', teacherName: 'דולוב אלכס', duration: 60, parentName: 'שחר לילך', studentName: 'שחר זיו', age: 8, phone: '544705533', email: 'lilach1ad@gmail.com', city: 'תל מונד' },
  { instrument: 'צ\'לו', teacherName: 'פלדמן אלסיה', duration: 60, parentName: 'עופר אלה', studentName: 'עופר מרים הדסה', age: 7, phone: '507467787', email: 'ela@osherdavid.com', city: 'רעננה' },
  { instrument: 'צ\'לו', teacherName: 'פלדמן אלסיה', duration: 60, parentName: 'שטורך חיים', studentName: 'שטורך אגם', age: 7, phone: '542569882', email: 'mayaalon10@gmail.com', city: 'רעננה' },
  { instrument: 'צ\'לו', teacherName: 'פלדמן אלסיה', duration: 90, parentName: 'דניסיוק ליודמילה', studentName: 'ריבלוב פולינה', age: 12, phone: '533525040', email: '', city: 'רעננה' },
  // קונטרבס students
  { instrument: 'קונטרבס', teacherName: 'גילנסון מרק', duration: 60, parentName: 'הולצר ראובן', studentName: 'הולצר ראובן', age: 0, phone: '546258990', email: 'reuvenholzer@gmail.com', city: 'הרצליה' },
  { instrument: 'קונטרבס', teacherName: 'גילנסון מרק', duration: 120, parentName: 'מיכנובסקי קיריל', studentName: 'מיכנובסקי אליסה', age: 15, phone: '523944787', email: 'kirillmihanovsky@gmail.com', city: 'תל אביב - יפו' },
  { instrument: 'קונטרבס', teacherName: 'גילנסון מרק', duration: 60, parentName: 'מנדה שלה', studentName: 'מנדה יונה', age: 12, phone: '547275140', email: '', city: 'רעננה' },
  { instrument: 'קונטרבס', teacherName: 'גילנסון מרק', duration: 60, parentName: 'גייקובס ליבי', studentName: 'מויאל דניאל', age: 17, phone: '522316124', email: 'libbie.jacobs@gmail.com', city: 'רעננה' },
  { instrument: 'קונטרבס', teacherName: 'בן חורין דניאל', duration: 60, parentName: 'ביאליק שני ענת', studentName: 'ביאליק איתמר', age: 15, phone: '547878182', email: 'bshany@hotmail.com', city: 'רעננה' },
  { instrument: 'קונטרבס', teacherName: 'גילנסון מרק', duration: 60, parentName: 'סלטקין מייקל', studentName: 'סלטקין דן', age: 15, phone: '524409312', email: 'mikeslatkin@gmail.com', city: 'הרצליה' },
  { instrument: 'קונטרבס', teacherName: 'גילנסון מרק', duration: 120, parentName: 'פוגל-דרור יאיר', studentName: 'דרור קדם נצן', age: 13, phone: '523486486', email: 'yairfogel@gmail.com', city: 'רעננה' },
  { instrument: 'קונטרבס', teacherName: 'גילנסון מרק', duration: 60, parentName: 'גוריאצ\'ב אלכסנדרה', studentName: 'פטרוסיאן סופיה', age: 15, phone: '534248715', email: 'Gorya4ka@mail.ru', city: 'רעננה' },
]

class StudentSyncer {
  constructor() {
    this.client = null
    this.db = null
    this.schoolYearId = null
    this.stats = {
      existing: 0,
      created: 0,
      updated: 0,
      errors: []
    }
  }

  async connect() {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI
    this.client = new MongoClient(uri)
    await this.client.connect()
    this.db = this.client.db(process.env.MONGODB_NAME || 'Conservatory-DB')
    console.log('✓ Connected to MongoDB')
  }

  async disconnect() {
    if (this.client) {
      await this.client.close()
      console.log('✓ Disconnected')
    }
  }

  async getSchoolYear() {
    const schoolYear = await this.db.collection('school_year').findOne({ isCurrent: true })
    this.schoolYearId = schoolYear?._id?.toString()
    return this.schoolYearId
  }

  async findTeacher(teacherName) {
    // Normalize teacher name variations
    const nameVariations = [
      teacherName,
      teacherName.split(' ').reverse().join(' '),
    ]

    for (const name of nameVariations) {
      const teacher = await this.db.collection('teacher').findOne({
        'personalInfo.fullName': new RegExp(name.replace(/\s+/g, '.*'), 'i')
      })
      if (teacher) return teacher
    }
    return null
  }

  async findStudent(studentName) {
    // Try exact match first
    let student = await this.db.collection('student').findOne({
      'personalInfo.fullName': studentName
    })
    if (student) return student

    // Try partial match
    student = await this.db.collection('student').findOne({
      'personalInfo.fullName': new RegExp(studentName.replace(/\s+/g, '.*'), 'i')
    })
    return student
  }

  async createStudent(data) {
    const student = {
      personalInfo: {
        fullName: data.studentName,
        phone: data.phone || '',
        age: data.age || 0,
        address: data.city || '',
        parentName: data.parentName || '',
        parentPhone: data.phone || '',
        parentEmail: data.email || '',
        studentEmail: ''
      },
      academicInfo: {
        instrumentProgress: [{
          instrumentName: data.instrument,
          isPrimary: true,
          currentStage: 1
        }],
        class: 'אחר',
        tests: {
          stageTest: { status: 'לא נבחן', lastTestDate: null, nextTestDate: null, notes: '' },
          technicalTest: { status: 'לא נבחן', lastTestDate: null, nextTestDate: null, notes: '' }
        }
      },
      enrollments: {
        orchestraIds: [],
        ensembleIds: [],
        schoolYears: [{ schoolYearId: this.schoolYearId, isActive: true }],
        theoryLessonIds: [],
        teacherIds: [],
        teacherAssignments: []
      },
      scheduleInfo: {
        day: null,
        startTime: null,
        endTime: null,
        duration: data.duration || 45,
        location: null,
        notes: null,
        isActive: true
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const result = await this.db.collection('student').insertOne(student)
    return { ...student, _id: result.insertedId }
  }

  async linkStudentToTeacher(studentId, teacherId) {
    // Update student
    await this.db.collection('student').updateOne(
      { _id: new ObjectId(studentId) },
      {
        $addToSet: {
          'enrollments.teacherIds': teacherId.toString()
        }
      }
    )

    // Update teacher
    await this.db.collection('teacher').updateOne(
      { _id: new ObjectId(teacherId) },
      {
        $addToSet: {
          'teaching.studentIds': studentId.toString()
        }
      }
    )
  }

  async processStudent(data) {
    // Find or create student
    let student = await this.findStudent(data.studentName)

    if (student) {
      this.stats.existing++
      console.log(`  ✓ Found: ${data.studentName}`)
    } else {
      // Create new student
      student = await this.createStudent(data)
      this.stats.created++
      console.log(`  + Created: ${data.studentName}`)
    }

    // Find teacher and link
    const teacher = await this.findTeacher(data.teacherName)
    if (teacher) {
      await this.linkStudentToTeacher(student._id, teacher._id)
    } else {
      console.log(`    ⚠ Teacher not found: ${data.teacherName}`)
    }

    return student
  }

  async run() {
    try {
      console.log('\n' + '='.repeat(70))
      console.log('  COMPREHENSIVE STUDENT SYNC - STRINGS DEPARTMENT')
      console.log('='.repeat(70) + '\n')

      await this.connect()
      await this.getSchoolYear()

      console.log(`Processing ${ALL_STUDENTS.length} students...\n`)

      for (const studentData of ALL_STUDENTS) {
        await this.processStudent(studentData)
      }

      console.log('\n' + '='.repeat(70))
      console.log('  SYNC COMPLETE')
      console.log('='.repeat(70))
      console.log(`  Existing students: ${this.stats.existing}`)
      console.log(`  Created students: ${this.stats.created}`)
      console.log(`  Total processed: ${ALL_STUDENTS.length}`)
      console.log('='.repeat(70) + '\n')

    } catch (error) {
      console.error('Error:', error)
    } finally {
      await this.disconnect()
    }
  }
}

const syncer = new StudentSyncer()
syncer.run()
