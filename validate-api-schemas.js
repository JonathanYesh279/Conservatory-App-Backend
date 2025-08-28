#!/usr/bin/env node

/**
 * API Schema Validation Script
 * Validates all API responses against frontend requirements
 */

import fs from 'fs';

// Expected constants from frontend
const VALID_CLASSES = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'יא', 'יב', 'אחר'];
const VALID_STAGES = [1, 2, 3, 4, 5, 6, 7, 8];
const VALID_INSTRUMENTS = [
  'חלילית', 'חליל צד', 'אבוב', 'בסון', 'סקסופון', 'קלרינט',
  'חצוצרה', 'קרן יער', 'טרומבון', 'טובה/בריטון', 'שירה',
  'כינור', 'ויולה', "צ'לו", 'קונטרבס', 'פסנתר', 'גיטרה', 'גיטרה בס', 'תופים'
];
const VALID_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];
const VALID_DURATIONS = [30, 45, 60];
const VALID_RULES = ['מורה', 'מנצח', 'מדריך הרכב', 'מנהל', 'מורה תאוריה', 'מגמה'];
const TEST_STATUSES = ['לא נבחן', 'עבר/ה', 'לא עבר/ה', 'עבר/ה בהצטיינות', 'עבר/ה בהצטיינות יתרה'];

// Phone pattern validation
const PHONE_PATTERN = /^05\d{8}$/;

function validateSchema(data, schemaName) {
  console.log(`\n🔍 Validating ${schemaName} Schema`);
  console.log('=' .repeat(50));
  
  const issues = [];
  let validCount = 0;
  let totalCount = Array.isArray(data) ? data.length : 1;
  
  const items = Array.isArray(data) ? data : [data];
  
  items.forEach((item, index) => {
    const itemIssues = [];
    
    if (schemaName === 'Student') {
      itemIssues.push(...validateStudentSchema(item, index));
    } else if (schemaName === 'Teacher') {
      itemIssues.push(...validateTeacherSchema(item, index));
    } else if (schemaName === 'Theory') {
      itemIssues.push(...validateTheorySchema(item, index));
    } else if (schemaName === 'Orchestra') {
      itemIssues.push(...validateOrchestraSchema(item, index));
    } else if (schemaName === 'Rehearsal') {
      itemIssues.push(...validateRehearsalSchema(item, index));
    }
    
    if (itemIssues.length === 0) {
      validCount++;
    }
    
    issues.push(...itemIssues);
  });
  
  // Summary
  console.log(`📊 Validation Summary:`);
  console.log(`   Total items: ${totalCount}`);
  console.log(`   Valid items: ${validCount}`);
  console.log(`   Invalid items: ${totalCount - validCount}`);
  console.log(`   Total issues: ${issues.length}`);
  
  if (issues.length > 0) {
    console.log(`\n❌ Issues Found:`);
    issues.forEach(issue => {
      console.log(`   • ${issue}`);
    });
  } else {
    console.log(`\n✅ All ${schemaName} records are valid!`);
  }
  
  return { validCount, totalCount, issues };
}

function validateStudentSchema(student, index) {
  const issues = [];
  const prefix = `Student[${index}]`;
  
  // Required fields
  if (!student._id) issues.push(`${prefix}: Missing _id`);
  if (!student.personalInfo) issues.push(`${prefix}: Missing personalInfo`);
  if (!student.academicInfo) issues.push(`${prefix}: Missing academicInfo`);
  if (!student.hasOwnProperty('teacherAssignments')) issues.push(`${prefix}: Missing teacherAssignments array`);
  
  if (student.personalInfo) {
    // Phone validation
    if (student.personalInfo.phone && !PHONE_PATTERN.test(student.personalInfo.phone)) {
      issues.push(`${prefix}: Invalid phone pattern: ${student.personalInfo.phone}`);
    }
    if (student.personalInfo.parentPhone && !PHONE_PATTERN.test(student.personalInfo.parentPhone)) {
      issues.push(`${prefix}: Invalid parentPhone pattern: ${student.personalInfo.parentPhone}`);
    }
    
    // Hebrew text encoding check
    if (student.personalInfo.fullName && !isHebrewOrEnglish(student.personalInfo.fullName)) {
      issues.push(`${prefix}: fullName encoding issue: ${student.personalInfo.fullName}`);
    }
  }
  
  if (student.academicInfo) {
    // Class validation
    if (student.academicInfo.class && !VALID_CLASSES.includes(student.academicInfo.class)) {
      issues.push(`${prefix}: Invalid class: ${student.academicInfo.class}`);
    }
    
    // Instrument progress validation
    if (student.academicInfo.instrumentProgress) {
      student.academicInfo.instrumentProgress.forEach((inst, instIndex) => {
        if (inst.instrumentName && !VALID_INSTRUMENTS.includes(inst.instrumentName)) {
          issues.push(`${prefix}: Invalid instrument[${instIndex}]: ${inst.instrumentName}`);
        }
        if (inst.currentStage && !VALID_STAGES.includes(inst.currentStage)) {
          issues.push(`${prefix}: Invalid currentStage[${instIndex}]: ${inst.currentStage}`);
        }
        if (!inst.hasOwnProperty('isPrimary')) {
          issues.push(`${prefix}: Missing isPrimary field in instrumentProgress[${instIndex}]`);
        }
        
        // Test status validation
        if (inst.tests) {
          ['stageTest', 'technicalTest'].forEach(testType => {
            if (inst.tests[testType] && inst.tests[testType].status) {
              if (!TEST_STATUSES.includes(inst.tests[testType].status)) {
                issues.push(`${prefix}: Invalid ${testType} status[${instIndex}]: ${inst.tests[testType].status}`);
              }
            }
          });
        }
      });
    }
  }
  
  // TeacherAssignments validation
  if (student.teacherAssignments && Array.isArray(student.teacherAssignments)) {
    student.teacherAssignments.forEach((assignment, assignIndex) => {
      if (assignment.day && !VALID_DAYS.includes(assignment.day)) {
        issues.push(`${prefix}: Invalid teacherAssignment[${assignIndex}] day: ${assignment.day}`);
      }
      if (assignment.duration && !VALID_DURATIONS.includes(assignment.duration)) {
        issues.push(`${prefix}: Invalid teacherAssignment[${assignIndex}] duration: ${assignment.duration}`);
      }
      if (assignment.time && !/^\d{2}:\d{2}$/.test(assignment.time)) {
        issues.push(`${prefix}: Invalid teacherAssignment[${assignIndex}] time format: ${assignment.time}`);
      }
    });
  }
  
  // Date validation
  if (student.createdAt && !isValidISODate(student.createdAt)) {
    issues.push(`${prefix}: Invalid createdAt date format: ${student.createdAt}`);
  }
  if (student.updatedAt && !isValidISODate(student.updatedAt)) {
    issues.push(`${prefix}: Invalid updatedAt date format: ${student.updatedAt}`);
  }
  
  return issues;
}

function validateTeacherSchema(teacher, index) {
  const issues = [];
  const prefix = `Teacher[${index}]`;
  
  // Required fields
  if (!teacher._id) issues.push(`${prefix}: Missing _id`);
  if (!teacher.personalInfo) issues.push(`${prefix}: Missing personalInfo`);
  if (!teacher.teaching) issues.push(`${prefix}: Missing teaching object`);
  if (!teacher.hasOwnProperty('teaching') || !teacher.teaching.hasOwnProperty('studentIds')) {
    issues.push(`${prefix}: Missing teaching.studentIds array`);
  }
  
  if (teacher.personalInfo) {
    // Phone validation
    if (teacher.personalInfo.phone && !PHONE_PATTERN.test(teacher.personalInfo.phone)) {
      issues.push(`${prefix}: Invalid phone pattern: ${teacher.personalInfo.phone}`);
    }
    
    // Hebrew text encoding check
    if (teacher.personalInfo.fullName && !isHebrewOrEnglish(teacher.personalInfo.fullName)) {
      issues.push(`${prefix}: fullName encoding issue: ${teacher.personalInfo.fullName}`);
    }
  }
  
  // Roles validation
  if (teacher.roles && Array.isArray(teacher.roles)) {
    teacher.roles.forEach((role, roleIndex) => {
      if (!VALID_RULES.includes(role)) {
        issues.push(`${prefix}: Invalid role[${roleIndex}]: ${role}`);
      }
    });
  }
  
  // Professional info validation
  if (teacher.professionalInfo && teacher.professionalInfo.instrument) {
    if (!VALID_INSTRUMENTS.includes(teacher.professionalInfo.instrument)) {
      issues.push(`${prefix}: Invalid instrument: ${teacher.professionalInfo.instrument}`);
    }
  }
  
  // Date validation
  if (teacher.createdAt && !isValidISODate(teacher.createdAt)) {
    issues.push(`${prefix}: Invalid createdAt date format: ${teacher.createdAt}`);
  }
  if (teacher.updatedAt && !isValidISODate(teacher.updatedAt)) {
    issues.push(`${prefix}: Invalid updatedAt date format: ${teacher.updatedAt}`);
  }
  
  return issues;
}

function validateTheorySchema(theory, index) {
  const issues = [];
  const prefix = `Theory[${index}]`;
  
  // Basic validation for theory lessons
  if (!theory._id) issues.push(`${prefix}: Missing _id`);
  
  return issues;
}

function validateOrchestraSchema(orchestra, index) {
  const issues = [];
  const prefix = `Orchestra[${index}]`;
  
  // Basic validation for orchestras
  if (!orchestra._id) issues.push(`${prefix}: Missing _id`);
  if (!orchestra.name) issues.push(`${prefix}: Missing name`);
  
  return issues;
}

function validateRehearsalSchema(rehearsal, index) {
  const issues = [];
  const prefix = `Rehearsal[${index}]`;
  
  // Basic validation for rehearsals
  if (!rehearsal._id) issues.push(`${prefix}: Missing _id`);
  
  // Date validation
  if (rehearsal.date && !isValidISODate(rehearsal.date)) {
    issues.push(`${prefix}: Invalid date format: ${rehearsal.date}`);
  }
  
  // Day validation
  if (rehearsal.dayOfWeek && !VALID_DAYS.includes(rehearsal.dayOfWeek)) {
    issues.push(`${prefix}: Invalid dayOfWeek: ${rehearsal.dayOfWeek}`);
  }
  
  return issues;
}

function isValidISODate(dateString) {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date) && date.toISOString() === dateString;
}

function isHebrewOrEnglish(text) {
  // Check if text contains Hebrew, English, or common symbols
  const hebrewRegex = /[\u0590-\u05FF]/;
  const englishRegex = /[a-zA-Z]/;
  const validChars = /^[\u0590-\u05FF\sa-zA-Z0-9.,\-_\(\)]+$/;
  
  return validChars.test(text) && (hebrewRegex.test(text) || englishRegex.test(text));
}

async function main() {
  console.log('🔍 API Schema Validation Report');
  console.log('=====================================');
  
  const files = [
    { file: 'test-results-_student.json', schema: 'Student' },
    { file: 'test-results-_teacher.json', schema: 'Teacher' },
    { file: 'test-results-_theory.json', schema: 'Theory' },
    { file: 'test-results-_orchestra.json', schema: 'Orchestra' },
    { file: 'test-results-_rehearsal.json', schema: 'Rehearsal' }
  ];
  
  const results = {};
  
  for (const { file, schema } of files) {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      results[schema] = validateSchema(data.data, schema);
    } catch (error) {
      console.log(`❌ Error reading ${file}: ${error.message}`);
      results[schema] = { validCount: 0, totalCount: 0, issues: [`File read error: ${error.message}`] };
    }
  }
  
  // Overall summary
  console.log('\n📋 OVERALL SUMMARY');
  console.log('==================');
  
  let totalValid = 0;
  let totalItems = 0;
  let totalIssues = 0;
  
  Object.entries(results).forEach(([schema, result]) => {
    totalValid += result.validCount;
    totalItems += result.totalCount;
    totalIssues += result.issues.length;
    
    const percentage = result.totalCount > 0 ? ((result.validCount / result.totalCount) * 100).toFixed(1) : '0';
    console.log(`${schema}: ${result.validCount}/${result.totalCount} valid (${percentage}%)`);
  });
  
  console.log(`\nTotal: ${totalValid}/${totalItems} valid items`);
  console.log(`Total issues found: ${totalIssues}`);
  
  if (totalIssues === 0) {
    console.log('\n🎉 All API responses are frontend-compatible!');
  } else {
    console.log('\n⚠️  API compatibility issues detected. See details above.');
  }
}

main().catch(console.error);