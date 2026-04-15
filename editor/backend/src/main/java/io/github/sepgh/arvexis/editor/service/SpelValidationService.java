package io.github.sepgh.arvexis.editor.service;

import org.springframework.expression.ParseException;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.stereotype.Service;

/**
 * Validates SpEL expressions for syntax correctness.
 * Mode "assignment" expects an assignment expression (e.g. {@code #VAR = #VAR + 1}).
 * Mode "boolean" expects a boolean predicate (e.g. {@code #SCORE > 50}).
 */
@Service
public class SpelValidationService {

    private final SpelExpressionParser parser = new SpelExpressionParser();

    public record ValidationResult(boolean valid, String error) {}

    public ValidationResult validate(String expression, String mode) {
        if (expression == null || expression.isBlank()) {
            return new ValidationResult(false, "Expression must not be blank");
        }
        try {
            parser.parseExpression(expression);
            return new ValidationResult(true, null);
        } catch (ParseException ex) {
            return new ValidationResult(false, ex.getSimpleMessage());
        }
    }
}
