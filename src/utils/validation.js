/**
 * Input validation utilities for Fire FC
 */

// Email validation
export const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

// Password validation (min 6 chars, as per Supabase default)
export const isValidPassword = (password) => {
    return password && password.length >= 6;
};

// Name validation (letters, spaces, hyphens, apostrophes)
export const isValidName = (name) => {
    const nameRegex = /^[a-zA-Z\s'-]+$/;
    return name && name.trim().length >= 2 && nameRegex.test(name);
};

// PIN validation (4 digits)
export const isValidPin = (pin) => {
    return /^\d{4}$/.test(pin);
};

// Team code validation (format: FC-XXXX)
export const isValidTeamCode = (code) => {
    return /^FC-[A-Z0-9]{4}$/i.test(code);
};

// Jersey number validation (1-99)
export const isValidJerseyNumber = (number) => {
    const num = parseInt(number, 10);
    return !isNaN(num) && num >= 1 && num <= 99;
};

// Sanitize text input (remove potential XSS)
export const sanitizeInput = (input) => {
    if (typeof input !== 'string') return input;
    return input
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .trim();
};

// Validation error messages
export const validationMessages = {
    email: 'Please enter a valid email address',
    password: 'Password must be at least 6 characters',
    name: 'Please enter a valid name (letters only, min 2 characters)',
    pin: 'PIN must be exactly 4 digits',
    teamCode: 'Team code must be in format FC-XXXX',
    jerseyNumber: 'Jersey number must be between 1 and 99',
    required: 'This field is required'
};

// Form validator helper
export const validateForm = (fields) => {
    const errors = {};
    
    Object.entries(fields).forEach(([fieldName, { value, rules }]) => {
        rules.forEach(rule => {
            if (errors[fieldName]) return; // Skip if already has error
            
            switch (rule) {
                case 'required':
                    if (!value || (typeof value === 'string' && !value.trim())) {
                        errors[fieldName] = validationMessages.required;
                    }
                    break;
                case 'email':
                    if (value && !isValidEmail(value)) {
                        errors[fieldName] = validationMessages.email;
                    }
                    break;
                case 'password':
                    if (value && !isValidPassword(value)) {
                        errors[fieldName] = validationMessages.password;
                    }
                    break;
                case 'name':
                    if (value && !isValidName(value)) {
                        errors[fieldName] = validationMessages.name;
                    }
                    break;
                case 'pin':
                    if (value && !isValidPin(value)) {
                        errors[fieldName] = validationMessages.pin;
                    }
                    break;
                default:
                    break;
            }
        });
    });
    
    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
};
