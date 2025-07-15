import { getCollection } from './mongoDB.service.js';
import { ObjectId } from 'mongodb';

/**
 * Advanced Duplicate Detection Service
 * Detects potential duplicate teachers based on multiple criteria combinations
 * to prevent unnecessary duplications in the system
 */

export class DuplicateDetectionService {
  
  /**
   * Comprehensive duplicate detection for teachers
   * Checks various combinations of personal information to identify potential duplicates
   */
  static async detectTeacherDuplicates(teacherData, excludeId = null) {
    try {
      const collection = await getCollection('teacher');
      const { personalInfo } = teacherData;
      
      // Normalize data for comparison
      const normalizedName = this.normalizeName(personalInfo.fullName);
      const normalizedPhone = this.normalizePhone(personalInfo.phone);
      const normalizedAddress = this.normalizeAddress(personalInfo.address);
      const normalizedEmail = personalInfo.email?.toLowerCase().trim();
      
      // Build base query (exclude current teacher if updating)
      const baseQuery = {
        isActive: true,
        ...(excludeId && { _id: { $ne: ObjectId.createFromHexString(excludeId) } })
      };
      
      const duplicateChecks = [];
      
      // 1. Exact email match (handled by unique constraints, but included for completeness)
      if (normalizedEmail) {
        const emailDuplicates = await collection.find({
          ...baseQuery,
          $or: [
            { 'personalInfo.email': normalizedEmail },
            { 'credentials.email': normalizedEmail }
          ]
        }).toArray();
        
        if (emailDuplicates.length > 0) {
          duplicateChecks.push({
            type: 'EMAIL_DUPLICATE',
            severity: 'HIGH',
            message: `Teacher with email "${personalInfo.email}" already exists`,
            matches: emailDuplicates.map(t => this.formatTeacherMatch(t)),
            conflictingField: 'email'
          });
        }
      }
      
      // 2. Exact phone number match
      if (normalizedPhone) {
        const phoneDuplicates = await collection.find({
          ...baseQuery,
          'personalInfo.phone': normalizedPhone
        }).toArray();
        
        if (phoneDuplicates.length > 0) {
          duplicateChecks.push({
            type: 'PHONE_DUPLICATE',
            severity: 'HIGH',
            message: `Teacher with phone number "${personalInfo.phone}" already exists`,
            matches: phoneDuplicates.map(t => this.formatTeacherMatch(t)),
            conflictingField: 'phone'
          });
        }
      }
      
      // 3. Exact name + phone combination
      if (normalizedName && normalizedPhone) {
        const namePhoneDuplicates = await collection.find({
          ...baseQuery,
          $and: [
            { 'personalInfo.phone': normalizedPhone },
            { 'personalInfo.fullName': { $regex: this.createNameRegex(normalizedName), $options: 'i' } }
          ]
        }).toArray();
        
        if (namePhoneDuplicates.length > 0) {
          duplicateChecks.push({
            type: 'NAME_PHONE_DUPLICATE',
            severity: 'HIGH',
            message: `Teacher with same name "${personalInfo.fullName}" and phone number "${personalInfo.phone}" already exists`,
            matches: namePhoneDuplicates.map(t => this.formatTeacherMatch(t)),
            conflictingFields: ['fullName', 'phone']
          });
        }
      }
      
      // 4. Exact name + address combination
      if (normalizedName && normalizedAddress) {
        const nameAddressDuplicates = await collection.find({
          ...baseQuery,
          $and: [
            { 'personalInfo.fullName': { $regex: this.createNameRegex(normalizedName), $options: 'i' } },
            { 'personalInfo.address': { $regex: this.createAddressRegex(normalizedAddress), $options: 'i' } }
          ]
        }).toArray();
        
        if (nameAddressDuplicates.length > 0) {
          duplicateChecks.push({
            type: 'NAME_ADDRESS_DUPLICATE',
            severity: 'MEDIUM',
            message: `Teacher with same name "${personalInfo.fullName}" and similar address "${personalInfo.address}" already exists`,
            matches: nameAddressDuplicates.map(t => this.formatTeacherMatch(t)),
            conflictingFields: ['fullName', 'address']
          });
        }
      }
      
      // 5. Phone + address combination
      if (normalizedPhone && normalizedAddress) {
        const phoneAddressDuplicates = await collection.find({
          ...baseQuery,
          $and: [
            { 'personalInfo.phone': normalizedPhone },
            { 'personalInfo.address': { $regex: this.createAddressRegex(normalizedAddress), $options: 'i' } }
          ]
        }).toArray();
        
        if (phoneAddressDuplicates.length > 0) {
          duplicateChecks.push({
            type: 'PHONE_ADDRESS_DUPLICATE',
            severity: 'HIGH',
            message: `Teacher with same phone number "${personalInfo.phone}" and similar address "${personalInfo.address}" already exists`,
            matches: phoneAddressDuplicates.map(t => this.formatTeacherMatch(t)),
            conflictingFields: ['phone', 'address']
          });
        }
      }
      
      // 6. Triple combination: name + phone + address (most likely duplicate)
      if (normalizedName && normalizedPhone && normalizedAddress) {
        const tripleDuplicates = await collection.find({
          ...baseQuery,
          $and: [
            { 'personalInfo.fullName': { $regex: this.createNameRegex(normalizedName), $options: 'i' } },
            { 'personalInfo.phone': normalizedPhone },
            { 'personalInfo.address': { $regex: this.createAddressRegex(normalizedAddress), $options: 'i' } }
          ]
        }).toArray();
        
        if (tripleDuplicates.length > 0) {
          duplicateChecks.push({
            type: 'FULL_PROFILE_DUPLICATE',
            severity: 'CRITICAL',
            message: `Teacher with identical profile (name, phone, and address) already exists`,
            matches: tripleDuplicates.map(t => this.formatTeacherMatch(t)),
            conflictingFields: ['fullName', 'phone', 'address']
          });
        }
      }
      
      // 7. Similar name detection (fuzzy matching)
      if (normalizedName) {
        const similarNameDuplicates = await this.findSimilarNames(collection, normalizedName, baseQuery);
        
        if (similarNameDuplicates.length > 0) {
          duplicateChecks.push({
            type: 'SIMILAR_NAME_DUPLICATE',
            severity: 'LOW',
            message: `Teachers with similar names found`,
            matches: similarNameDuplicates.map(t => this.formatTeacherMatch(t)),
            conflictingField: 'fullName',
            note: 'These may be different people, but please verify'
          });
        }
      }
      
      // Remove duplicates from different check types (same teacher found in multiple checks)
      const uniqueChecks = this.deduplicateChecks(duplicateChecks);
      
      // Sort by severity (CRITICAL > HIGH > MEDIUM > LOW)
      const severityOrder = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
      uniqueChecks.sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity]);
      
      return {
        hasDuplicates: uniqueChecks.length > 0,
        duplicateCount: uniqueChecks.length,
        duplicates: uniqueChecks,
        recommendation: this.generateRecommendation(uniqueChecks)
      };
      
    } catch (error) {
      console.error('Error in duplicate detection:', error);
      throw new Error(`Duplicate detection failed: ${error.message}`);
    }
  }
  
  /**
   * Normalize name for better comparison
   */
  static normalizeName(name) {
    if (!name) return '';
    return name.trim()
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/['"]/g, '') // Remove quotes
      .toLowerCase();
  }
  
  /**
   * Normalize phone number for comparison
   */
  static normalizePhone(phone) {
    if (!phone) return '';
    return phone.replace(/[\s\-\(\)]/g, ''); // Remove spaces, dashes, parentheses
  }
  
  /**
   * Normalize address for comparison
   */
  static normalizeAddress(address) {
    if (!address) return '';
    return address.trim()
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .replace(/[,\.]/g, ''); // Remove commas and periods
  }
  
  /**
   * Create regex for name matching (handles word order variations)
   */
  static createNameRegex(normalizedName) {
    const words = normalizedName.split(' ').filter(word => word.length > 1);
    if (words.length <= 1) {
      return `^${this.escapeRegex(normalizedName)}$`;
    }
    
    // Create pattern that matches all words in any order
    const wordPatterns = words.map(word => `(?=.*${this.escapeRegex(word)})`);
    return `^${wordPatterns.join('')}.*$`;
  }
  
  /**
   * Create regex for address matching (handles minor variations)
   */
  static createAddressRegex(normalizedAddress) {
    const words = normalizedAddress.split(' ').filter(word => word.length > 2);
    if (words.length <= 1) {
      return this.escapeRegex(normalizedAddress);
    }
    
    // Match if at least 70% of significant words are present
    const minMatches = Math.ceil(words.length * 0.7);
    const wordPatterns = words.slice(0, minMatches).map(word => `(?=.*${this.escapeRegex(word)})`);
    return `^${wordPatterns.join('')}.*$`;
  }
  
  /**
   * Escape special regex characters
   */
  static escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  /**
   * Find similar names using fuzzy matching
   */
  static async findSimilarNames(collection, normalizedName, baseQuery) {
    // Simple approach: find names that share significant words
    const words = normalizedName.split(' ').filter(word => word.length > 2);
    if (words.length === 0) return [];
    
    const similarTeachers = [];
    
    for (const word of words) {
      const matches = await collection.find({
        ...baseQuery,
        'personalInfo.fullName': { 
          $regex: this.escapeRegex(word), 
          $options: 'i' 
        }
      }).toArray();
      
      matches.forEach(teacher => {
        const existingSimilarity = this.calculateNameSimilarity(normalizedName, this.normalizeName(teacher.personalInfo.fullName));
        if (existingSimilarity > 0.6 && existingSimilarity < 0.95) { // Similar but not exact
          if (!similarTeachers.find(t => t._id.equals(teacher._id))) {
            similarTeachers.push(teacher);
          }
        }
      });
    }
    
    return similarTeachers;
  }
  
  /**
   * Calculate name similarity (simple Jaccard similarity)
   */
  static calculateNameSimilarity(name1, name2) {
    const words1 = new Set(name1.split(' '));
    const words2 = new Set(name2.split(' '));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }
  
  /**
   * Format teacher match for response
   */
  static formatTeacherMatch(teacher) {
    return {
      id: teacher._id.toString(),
      fullName: teacher.personalInfo?.fullName,
      email: teacher.personalInfo?.email,
      phone: teacher.personalInfo?.phone,
      address: teacher.personalInfo?.address,
      roles: teacher.roles,
      createdAt: teacher.createdAt
    };
  }
  
  /**
   * Remove duplicate checks (same teacher found in multiple check types)
   */
  static deduplicateChecks(duplicateChecks) {
    const uniqueChecks = [];
    const processedTeacherIds = new Set();
    
    // Process in severity order to keep the most severe check for each teacher
    const sortedChecks = [...duplicateChecks].sort((a, b) => {
      const severityOrder = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
    
    for (const check of sortedChecks) {
      const teacherIds = check.matches.map(m => m.id);
      const hasNewTeacher = teacherIds.some(id => !processedTeacherIds.has(id));
      
      if (hasNewTeacher) {
        uniqueChecks.push(check);
        teacherIds.forEach(id => processedTeacherIds.add(id));
      }
    }
    
    return uniqueChecks;
  }
  
  /**
   * Generate recommendation based on duplicate findings
   */
  static generateRecommendation(duplicateChecks) {
    if (duplicateChecks.length === 0) {
      return 'No duplicates found. Safe to proceed.';
    }
    
    const hasCritical = duplicateChecks.some(check => check.severity === 'CRITICAL');
    const hasHigh = duplicateChecks.some(check => check.severity === 'HIGH');
    
    if (hasCritical) {
      return 'BLOCK CREATION: Critical duplicate detected. This appears to be an exact duplicate of an existing teacher.';
    }
    
    if (hasHigh) {
      return 'WARNING: High probability duplicate detected. Please verify this is not a duplicate before proceeding.';
    }
    
    return 'CAUTION: Potential duplicates found. Please review and confirm these are different people.';
  }
  
  /**
   * Check if creation should be blocked based on duplicate severity
   */
  static shouldBlockCreation(duplicateResult) {
    return duplicateResult.duplicates.some(check => 
      check.severity === 'CRITICAL' || 
      (check.severity === 'HIGH' && ['EMAIL_DUPLICATE', 'PHONE_DUPLICATE', 'FULL_PROFILE_DUPLICATE'].includes(check.type))
    );
  }
}

export default DuplicateDetectionService;