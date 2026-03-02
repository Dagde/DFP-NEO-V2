import React from 'react';

interface ValidationError {
    type: 'error' | 'warning';
    field: string;
    message: string;
    remediation: string;
}

interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
    warnings: ValidationError[];
}

interface ValidationErrorDisplayProps {
    validation: ValidationResult;
    className?: string;
}

const ValidationErrorDisplay: React.FC<ValidationErrorDisplayProps> = ({ validation, className = '' }) => {
    if (validation.isValid) {
        return null;
    }

    const ErrorIcon = () => (
        <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
    );

    const WarningIcon = () => (
        <svg className="w-5 h-5 text-yellow-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
    );

    const ToolIcon = () => (
        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
        </svg>
    );

    return (
        <div className={`space-y-3 ${className}`}>
            {validation.errors.length > 0 && (
                <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                        <ErrorIcon />
                        <div className="flex-1">
                            <h4 className="text-red-400 font-semibold mb-2">
                                Data Entry Errors ({validation.errors.length})
                            </h4>
                            <div className="space-y-2">
                                {validation.errors.map((error, index) => (
                                    <div key={index} className="text-sm">
                                        <p className="text-red-300 font-medium">{error.message}</p>
                                        <div className="flex items-start mt-1 space-x-2">
                                            <ToolIcon />
                                            <p className="text-red-200">{error.remediation}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {validation.warnings.length > 0 && (
                <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                        <WarningIcon />
                        <div className="flex-1">
                            <h4 className="text-yellow-400 font-semibold mb-2">
                                Warnings ({validation.warnings.length})
                            </h4>
                            <div className="space-y-2">
                                {validation.warnings.map((warning, index) => (
                                    <div key={index} className="text-sm">
                                        <p className="text-yellow-300 font-medium">{warning.message}</p>
                                        <div className="flex items-start mt-1 space-x-2">
                                            <ToolIcon />
                                            <p className="text-yellow-200">{warning.remediation}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ValidationErrorDisplay;