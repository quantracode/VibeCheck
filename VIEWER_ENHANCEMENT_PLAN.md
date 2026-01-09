# VibeCheck Viewer Enhancement Plan for AI-Native Developers

**Target Audience**: Developers who build products using AI assistance, coming from diverse backgrounds, focused on outcomes over CS theory.

**Goal**: Make security findings immediately understandable and actionable for non-security experts.

---

## Phase 1: Schema Extensions (Foundation)
**Impact**: High | **Effort**: Low | **Dependencies**: None

### 1.1 Extend Finding Schema

**File**: `packages/schema/src/schemas/finding.ts`

Add new optional fields to `FindingSchema`:

```typescript
export const FindingEnhancementsSchema = z.object({
  /** Plain English explanation (avoid jargon) */
  plainEnglish: z.object({
    /** What's wrong in simple terms */
    problem: z.string(),
    /** Why it matters (real-world impact) */
    impact: z.string(),
    /** What could happen if exploited */
    worstCase: z.string().optional(),
  }).optional(),

  /** Before/after code comparison for fixes */
  codeComparison: z.object({
    /** Current vulnerable code */
    before: z.string(),
    /** Secure version */
    after: z.string(),
    /** Line-by-line explanation of changes */
    changes: z.array(z.object({
      line: z.number(),
      explanation: z.string(),
    })).optional(),
  }).optional(),

  /** Step-by-step fix instructions */
  fixSteps: z.array(z.object({
    /** Step number */
    step: z.number(),
    /** Action to take */
    action: z.string(),
    /** Optional code to copy */
    code: z.string().optional(),
    /** Optional command to run */
    command: z.string().optional(),
    /** How to verify this step worked */
    verification: z.string().optional(),
  })).optional(),

  /** AI-friendly prompt for getting help */
  aiPrompt: z.object({
    /** Pre-formatted prompt for AI assistants */
    template: z.string(),
    /** Suggested follow-up questions */
    followUpQuestions: z.array(z.string()).optional(),
  }).optional(),

  /** Contextual severity explanation */
  severityContext: z.object({
    /** Plain English urgency */
    urgency: z.enum([
      "Fix immediately before deploying",
      "Should fix soon",
      "Good to fix eventually",
      "Nice to have"
    ]),
    /** Why this severity level */
    reasoning: z.string(),
  }).optional(),
});

// Add to FindingSchema
export const FindingSchema = z.object({
  // ... existing fields ...

  /** Enhanced information for AI-native developers */
  enhancements: FindingEnhancementsSchema.optional(),
});
```

**Why**: This is the foundation for all other features. By making it optional, we maintain backward compatibility while allowing gradual enhancement.

---

## Phase 2: CLI Enhancements (Data Generation)
**Impact**: High | **Effort**: Medium | **Dependencies**: Phase 1

### 2.1 Create Enhancement Generator

**File**: `packages/cli/src/scanners/helpers/finding-enhancer.ts` (NEW)

```typescript
/**
 * Enhances findings with AI-native developer friendly content
 */
export function enhanceFinding(finding: Finding): Finding {
  return {
    ...finding,
    enhancements: {
      plainEnglish: generatePlainEnglish(finding),
      codeComparison: generateCodeComparison(finding),
      fixSteps: generateFixSteps(finding),
      aiPrompt: generateAIPrompt(finding),
      severityContext: generateSeverityContext(finding),
    },
  };
}
```

### 2.2 Implement Enhancement Functions

**Functions to implement**:

1. **`generatePlainEnglish()`** - Convert technical descriptions to plain English
   - Use rule-specific templates
   - Map CWE/OWASP to everyday language
   - Focus on "what" and "why" not "how"

2. **`generateCodeComparison()`** - Create before/after examples
   - Extract actual vulnerable code from evidence
   - Generate secure version using remediation.recommendedFix
   - Add inline comments explaining changes

3. **`generateFixSteps()`** - Break down remediation into steps
   - Parse recommendedFix into actionable steps
   - Add copy-able commands and code snippets
   - Include verification steps

4. **`generateAIPrompt()`** - Create AI assistant prompts
   - Template: "I have a security finding... [context] ... Can you help me fix this?"
   - Include file path, code snippet, issue description
   - Add suggested follow-up questions

5. **`generateSeverityContext()`** - Explain severity in plain terms
   - Map severity levels to urgency descriptions
   - Explain why this level was assigned
   - Provide business impact context

### 2.3 Update Scanner Integration

**File**: `packages/cli/src/commands/scan.ts`

Add enhancement step after all scanners run:

```typescript
// After running all scanners
console.log("Enhancing findings for clarity...");
const enhancedFindings = findings.map(f => enhanceFinding(f));
```

**Success Criteria**:
- [ ] All existing scanners work without changes
- [ ] Enhanced findings include plain English explanations
- [ ] Code comparisons are generated where remediation exists
- [ ] AI prompts are contextual and copy-able

---

## Phase 3: Viewer UI - Foundation
**Impact**: High | **Effort**: Medium | **Dependencies**: Phase 2

### 3.1 Plain English Display (#1)

**Component**: `FindingDetail` (viewer)

```tsx
// Primary display (always visible)
<div className="finding-header">
  <h1 className="text-2xl">
    {finding.enhancements?.plainEnglish?.problem || finding.title}
  </h1>
  <p className="text-muted-foreground mt-2">
    {finding.enhancements?.plainEnglish?.impact || finding.description}
  </p>
</div>

// Technical details (collapsible)
<Collapsible>
  <CollapsibleTrigger>Show Technical Details</CollapsibleTrigger>
  <CollapsibleContent>
    <dl>
      <dt>Rule ID</dt><dd>{finding.ruleId}</dd>
      <dt>CWE</dt><dd><a href={finding.links?.cwe}>...</a></dd>
      <dt>Confidence</dt><dd>{finding.confidence * 100}%</dd>
    </dl>
  </CollapsibleContent>
</Collapsible>
```

### 3.2 "Why This Matters" Section (#2)

**Component**: `WhyThisMatters`

```tsx
<Card className="bg-blue-50 border-blue-200">
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <LightbulbIcon /> Why this matters
    </CardTitle>
  </CardHeader>
  <CardContent>
    <p>{finding.enhancements?.plainEnglish?.impact}</p>
    {finding.enhancements?.plainEnglish?.worstCase && (
      <Alert variant="warning" className="mt-4">
        <AlertTitle>Worst case scenario:</AlertTitle>
        <AlertDescription>
          {finding.enhancements.plainEnglish.worstCase}
        </AlertDescription>
      </Alert>
    )}
  </CardContent>
</Card>
```

### 3.3 Severity with Context (#6)

**Component**: `SeverityBadge`

```tsx
const severityConfig = {
  critical: {
    icon: "🔴",
    color: "bg-red-500",
    default: "Fix immediately before deploying",
  },
  high: {
    icon: "🟠",
    color: "bg-orange-500",
    default: "Fix before next release",
  },
  // ...
};

<Badge className={severityConfig[finding.severity].color}>
  {severityConfig[finding.severity].icon}
  {finding.enhancements?.severityContext?.urgency ||
   severityConfig[finding.severity].default}
</Badge>

{finding.enhancements?.severityContext?.reasoning && (
  <p className="text-sm text-muted-foreground mt-1">
    {finding.enhancements.severityContext.reasoning}
  </p>
)}
```

---

## Phase 4: Viewer UI - Code Assistance
**Impact**: High | **Effort**: Medium | **Dependencies**: Phase 3

### 4.1 Before/After Code Comparison (#4)

**Component**: `CodeComparison`

```tsx
<div className="grid grid-cols-2 gap-4">
  <Card>
    <CardHeader>
      <CardTitle className="text-red-600 flex items-center gap-2">
        <XIcon /> Your current code
      </CardTitle>
    </CardHeader>
    <CardContent>
      <SyntaxHighlighter language="typescript" theme={vscodeDark}>
        {finding.enhancements?.codeComparison?.before ||
         finding.evidence[0].snippet}
      </SyntaxHighlighter>
    </CardContent>
  </Card>

  <Card>
    <CardHeader>
      <CardTitle className="text-green-600 flex items-center gap-2">
        <CheckIcon /> Secure version
      </CardTitle>
    </CardHeader>
    <CardContent>
      <SyntaxHighlighter language="typescript" theme={vscodeDark}>
        {finding.enhancements?.codeComparison?.after}
      </SyntaxHighlighter>
      <Button onClick={copyToClipboard} className="mt-2">
        <CopyIcon /> Copy secure code
      </Button>
    </CardContent>
  </Card>
</div>

{finding.enhancements?.codeComparison?.changes && (
  <div className="mt-4">
    <h4 className="font-medium mb-2">What changed:</h4>
    <ul className="space-y-2">
      {finding.enhancements.codeComparison.changes.map(change => (
        <li key={change.line} className="flex gap-2">
          <Badge variant="outline">Line {change.line}</Badge>
          <span>{change.explanation}</span>
        </li>
      ))}
    </ul>
  </div>
)}
```

### 4.2 "Copy to AI" Button (#3)

**Component**: `CopyToAIButton`

```tsx
const generateAIPrompt = () => {
  if (finding.enhancements?.aiPrompt?.template) {
    return finding.enhancements.aiPrompt.template;
  }

  // Fallback template
  return `I have a security finding in my code:

File: ${finding.evidence[0].file}
Issue: ${finding.enhancements?.plainEnglish?.problem || finding.title}

Current code:
\`\`\`typescript
${finding.evidence[0].snippet}
\`\`\`

Recommended fix: ${finding.remediation.recommendedFix}

Can you help me fix this? Show me the exact code changes I need to make.`;
};

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline">
      <SparklesIcon /> Ask AI for help
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" className="w-64">
    <DropdownMenuItem onClick={() => copyToClipboard(generateAIPrompt())}>
      <CopyIcon /> Copy prompt
    </DropdownMenuItem>
    <DropdownMenuItem asChild>
      <a href={`https://claude.ai/new?prompt=${encodeURIComponent(generateAIPrompt())}`}
         target="_blank">
        <ExternalLinkIcon /> Open in Claude
      </a>
    </DropdownMenuItem>
    <DropdownMenuItem asChild>
      <a href={`https://chat.openai.com/?prompt=${encodeURIComponent(generateAIPrompt())}`}
         target="_blank">
        <ExternalLinkIcon /> Open in ChatGPT
      </a>
    </DropdownMenuItem>

    {finding.enhancements?.aiPrompt?.followUpQuestions && (
      <>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Follow-up questions:</DropdownMenuLabel>
        {finding.enhancements.aiPrompt.followUpQuestions.map(q => (
          <DropdownMenuItem key={q} onClick={() => copyToClipboard(q)}>
            {q}
          </DropdownMenuItem>
        ))}
      </>
    )}
  </DropdownMenuContent>
</DropdownMenu>
```

### 4.3 Interactive Fix Path Wizard (#7)

**Component**: `FixWizard`

```tsx
<Card>
  <CardHeader>
    <CardTitle>How to fix this (step-by-step)</CardTitle>
  </CardHeader>
  <CardContent>
    {finding.enhancements?.fixSteps ? (
      <ol className="space-y-6">
        {finding.enhancements.fixSteps.map((step, idx) => (
          <li key={step.step} className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground
                            flex items-center justify-center font-bold">
                {step.step}
              </div>
            </div>
            <div className="flex-1">
              <h4 className="font-medium mb-2">{step.action}</h4>

              {step.command && (
                <div className="bg-muted p-3 rounded-lg font-mono text-sm mb-2">
                  {step.command}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-2"
                    onClick={() => copyToClipboard(step.command!)}
                  >
                    <CopyIcon className="w-3 h-3" />
                  </Button>
                </div>
              )}

              {step.code && (
                <div className="mb-2">
                  <SyntaxHighlighter language="typescript" customStyle={{fontSize: '0.875rem'}}>
                    {step.code}
                  </SyntaxHighlighter>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-1"
                    onClick={() => copyToClipboard(step.code!)}
                  >
                    <CopyIcon /> Copy code
                  </Button>
                </div>
              )}

              {step.verification && (
                <Alert className="mt-2">
                  <CheckCircleIcon className="w-4 h-4" />
                  <AlertTitle>How to test:</AlertTitle>
                  <AlertDescription>{step.verification}</AlertDescription>
                </Alert>
              )}

              <Checkbox
                id={`step-${step.step}`}
                className="mt-3"
                onCheckedChange={(checked) => markStepComplete(finding.id, step.step, checked)}
              />
              <label htmlFor={`step-${step.step}`} className="ml-2 text-sm">
                I've completed this step
              </label>
            </div>
          </li>
        ))}
      </ol>
    ) : (
      // Fallback to basic remediation
      <p>{finding.remediation.recommendedFix}</p>
    )}
  </CardContent>
</Card>
```

---

## Phase 5: Viewer UI - Progressive Disclosure
**Impact**: Medium | **Effort**: Low | **Dependencies**: Phase 3

### 5.1 Progressive Disclosure (#5)

**Component**: `FindingDetailLayout`

```tsx
<div className="space-y-6">
  {/* Always visible - Plain English */}
  <BasicInfoCard finding={finding} />
  <WhyThisMattersCard finding={finding} />
  <CodeComparisonCard finding={finding} />

  {/* Progressive disclosure */}
  <Tabs defaultValue="fix">
    <TabsList>
      <TabsTrigger value="fix">How to Fix</TabsTrigger>
      <TabsTrigger value="evidence">
        Evidence <Badge variant="outline">{finding.evidence.length}</Badge>
      </TabsTrigger>
      <TabsTrigger value="technical">Technical Details</TabsTrigger>
    </TabsList>

    <TabsContent value="fix">
      <FixWizard finding={finding} />
    </TabsContent>

    <TabsContent value="evidence">
      <EvidenceList evidence={finding.evidence} />
    </TabsContent>

    <TabsContent value="technical">
      <TechnicalDetails finding={finding} />
    </TabsContent>
  </Tabs>
</div>
```

### 5.2 Technical Details Component

```tsx
<Card>
  <CardHeader>
    <CardTitle>Technical Details</CardTitle>
    <CardDescription>
      For security engineers and compliance teams
    </CardDescription>
  </CardHeader>
  <CardContent>
    <dl className="grid grid-cols-2 gap-4">
      <div>
        <dt className="font-medium text-sm text-muted-foreground">Rule ID</dt>
        <dd className="font-mono">{finding.ruleId}</dd>
      </div>
      <div>
        <dt className="font-medium text-sm text-muted-foreground">Category</dt>
        <dd className="capitalize">{finding.category}</dd>
      </div>
      <div>
        <dt className="font-medium text-sm text-muted-foreground">Confidence</dt>
        <dd>{(finding.confidence * 100).toFixed(0)}%</dd>
      </div>
      <div>
        <dt className="font-medium text-sm text-muted-foreground">Fingerprint</dt>
        <dd className="font-mono text-xs truncate">{finding.fingerprint}</dd>
      </div>
    </dl>

    {finding.links && (
      <div className="mt-6">
        <h4 className="font-medium mb-2">References</h4>
        <div className="flex gap-2">
          {finding.links.cwe && (
            <Button variant="outline" size="sm" asChild>
              <a href={finding.links.cwe} target="_blank">
                <ExternalLinkIcon /> CWE
              </a>
            </Button>
          )}
          {finding.links.owasp && (
            <Button variant="outline" size="sm" asChild>
              <a href={finding.links.owasp} target="_blank">
                <ExternalLinkIcon /> OWASP
              </a>
            </Button>
          )}
        </div>
      </div>
    )}
  </CardContent>
</Card>
```

---

## Phase 6: Viewer UI - Advanced Features
**Impact**: Medium | **Effort**: Medium | **Dependencies**: Phase 4

### 6.1 "Ask AI About This" (#8)

**Component**: `AIAssistantDialog`

```tsx
<Dialog>
  <DialogTrigger asChild>
    <Button variant="outline">
      <HelpCircleIcon /> Ask AI About This
    </Button>
  </DialogTrigger>
  <DialogContent className="max-w-2xl">
    <DialogHeader>
      <DialogTitle>Get AI help with this finding</DialogTitle>
      <DialogDescription>
        Choose a question or create your own
      </DialogDescription>
    </DialogHeader>

    <div className="space-y-3">
      {predefinedQuestions.map(q => (
        <Button
          key={q.label}
          variant="outline"
          className="w-full justify-start text-left h-auto p-4"
          onClick={() => handleQuestion(q)}
        >
          <div>
            <div className="font-medium">{q.label}</div>
            <div className="text-sm text-muted-foreground mt-1">
              {q.description}
            </div>
          </div>
        </Button>
      ))}
    </div>

    <div className="mt-4">
      <Label>Or ask your own question:</Label>
      <Textarea
        placeholder="e.g., Will this break my existing authentication?"
        value={customQuestion}
        onChange={(e) => setCustomQuestion(e.target.value)}
        className="mt-2"
      />
      <Button onClick={handleCustomQuestion} className="mt-2">
        Generate prompt
      </Button>
    </div>
  </DialogContent>
</Dialog>

const predefinedQuestions = [
  {
    label: "I don't understand this finding",
    description: "Get a beginner-friendly explanation",
    prompt: (f) => `Can you explain this security issue in simple terms...`
  },
  {
    label: "How serious is this really?",
    description: "Understand the real-world risk",
    prompt: (f) => `What's the actual risk of this vulnerability...`
  },
  {
    label: "Will this break my existing code?",
    description: "Impact analysis for the fix",
    prompt: (f) => `If I apply this fix, what might break...`
  },
  {
    label: "What's the easiest way to fix this?",
    description: "Get step-by-step instructions",
    prompt: (f) => `What's the quickest way to fix...`
  },
];
```

### 6.2 Smart Waivers (#10)

**Component**: `WaiverDialog`

```tsx
<Dialog>
  <DialogTrigger asChild>
    <Button variant="ghost">
      <EyeOffIcon /> Mark as accepted risk
    </Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Why are you accepting this risk?</DialogTitle>
      <DialogDescription>
        This helps you learn when it's okay to ignore security warnings
      </DialogDescription>
    </DialogHeader>

    <RadioGroup value={reason} onValueChange={setReason}>
      <div className="space-y-3">
        <div className="flex items-start space-x-2">
          <RadioGroupItem value="internal" id="internal" />
          <Label htmlFor="internal" className="font-normal">
            <div className="font-medium">This endpoint is only used internally</div>
            <div className="text-sm text-muted-foreground">
              Not accessible from public internet
            </div>
          </Label>
        </div>

        <div className="flex items-start space-x-2">
          <RadioGroupItem value="other-protection" id="other-protection" />
          <Label htmlFor="other-protection" className="font-normal">
            <div className="font-medium">I have other protection in place</div>
            <div className="text-sm text-muted-foreground">
              Explain what protection you're using
            </div>
          </Label>
        </div>
        {reason === "other-protection" && (
          <Textarea
            placeholder="e.g., CloudFlare WAF rules, API gateway auth..."
            className="ml-6"
          />
        )}

        <div className="flex items-start space-x-2">
          <RadioGroupItem value="future-fix" id="future-fix" />
          <Label htmlFor="future-fix" className="font-normal">
            <div className="font-medium">I'll fix this in a future version</div>
            <div className="text-sm text-muted-foreground">
              Create a reminder or ticket
            </div>
          </Label>
        </div>

        <div className="flex items-start space-x-2">
          <RadioGroupItem value="false-positive" id="false-positive" />
          <Label htmlFor="false-positive" className="font-normal">
            <div className="font-medium">This is a false positive</div>
            <div className="text-sm text-muted-foreground">
              Tell us why so we can improve detection
            </div>
          </Label>
        </div>
        {reason === "false-positive" && (
          <Textarea
            placeholder="Why is this not actually a problem?"
            className="ml-6"
          />
        )}
      </div>
    </RadioGroup>

    <Alert className="mt-4">
      <InfoIcon className="w-4 h-4" />
      <AlertTitle>Learning opportunity</AlertTitle>
      <AlertDescription>
        Understanding when to accept security risks is an important skill.
        This decision will be recorded with your explanation.
      </AlertDescription>
    </Alert>

    <DialogFooter>
      <Button variant="outline" onClick={close}>Cancel</Button>
      <Button onClick={createWaiver}>Accept Risk</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## Phase 7: Viewer UI - Batch Operations
**Impact**: Medium | **Effort**: Low | **Dependencies**: Phase 4

### 7.1 Similar Issues Grouping (#12)

**Component**: `RelatedFindingsCard`

```tsx
{finding.relatedFindings && finding.relatedFindings.length > 0 && (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <LinkIcon /> Similar issues in your codebase
      </CardTitle>
      <CardDescription>
        {finding.relatedFindings.length} other file(s) have the same problem
      </CardDescription>
    </CardHeader>
    <CardContent>
      <ul className="space-y-2">
        {relatedFindings.map(related => (
          <li key={related.id} className="flex items-center justify-between p-3
                                         border rounded-lg hover:bg-muted/50">
            <div>
              <div className="font-medium">{related.evidence[0].file}</div>
              <div className="text-sm text-muted-foreground">
                Line {related.evidence[0].startLine}
              </div>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/findings/${related.id}`}>
                View <ChevronRightIcon />
              </Link>
            </Button>
          </li>
        ))}
      </ul>

      <Button className="w-full mt-4" onClick={handleBatchFix}>
        <ZapIcon /> Apply same fix to all {relatedFindings.length + 1} files
      </Button>
    </CardContent>
  </Card>
)}
```

### 7.2 Batch Fix Dialog

```tsx
<Dialog open={showBatchFix} onOpenChange={setShowBatchFix}>
  <DialogContent className="max-w-3xl">
    <DialogHeader>
      <DialogTitle>Apply fix to multiple files</DialogTitle>
      <DialogDescription>
        This will apply the same security fix to {selectedFindings.length} files
      </DialogDescription>
    </DialogHeader>

    <div className="space-y-4">
      <Alert>
        <CheckCircleIcon className="w-4 h-4" />
        <AlertTitle>What will happen:</AlertTitle>
        <AlertDescription>
          Each file will have the authentication check added at the same location.
          You can review and modify each file individually afterward.
        </AlertDescription>
      </Alert>

      <div className="max-h-96 overflow-y-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                />
              </th>
              <th className="text-left p-2">File</th>
              <th className="text-left p-2">Line</th>
              <th className="text-right p-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {selectedFindings.map(f => (
              <tr key={f.id} className="border-b hover:bg-muted/50">
                <td className="p-2">
                  <Checkbox
                    checked={selection.has(f.id)}
                    onCheckedChange={() => toggleSelection(f.id)}
                  />
                </td>
                <td className="p-2 font-mono text-sm">
                  {f.evidence[0].file}
                </td>
                <td className="p-2">{f.evidence[0].startLine}</td>
                <td className="p-2 text-right">
                  <Button variant="ghost" size="sm">
                    Preview
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    <DialogFooter>
      <Button variant="outline" onClick={() => setShowBatchFix(false)}>
        Cancel
      </Button>
      <Button onClick={applyBatchFix}>
        Apply to {selection.size} file(s)
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## Phase 8: Dashboard Improvements
**Impact**: High | **Effort**: Low | **Dependencies**: Phase 3

### 8.1 Redesigned Dashboard (#11)

**Component**: `Dashboard`

```tsx
<div className="space-y-6">
  {/* Hero Section */}
  <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
    <CardContent className="pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold mb-2">
            Security Score: {securityScore}/100
          </h2>
          <p className="text-muted-foreground">
            {getScoreDescription(securityScore)}
          </p>
        </div>
        <div className="text-6xl">
          {getScoreEmoji(securityScore)}
        </div>
      </div>
    </CardContent>
  </Card>

  {/* What's Good / What Needs Work */}
  <div className="grid md:grid-cols-2 gap-6">
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-green-600">
          <CheckCircleIcon /> What's working well
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {positiveFindings.map(item => (
            <li key={item} className="flex items-start gap-2">
              <CheckIcon className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-600">
          <AlertTriangleIcon /> Needs attention
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {prioritizedIssues.map(issue => (
            <li key={issue.category} className="border-l-4 border-orange-500 pl-3">
              <div className="font-medium">{issue.count} {issue.category} issue(s)</div>
              <div className="text-sm text-muted-foreground">{issue.description}</div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  </div>

  {/* Priority Action */}
  {criticalFinding && (
    <Card className="border-red-500 bg-red-50 dark:bg-red-950">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertOctagonIcon className="text-red-600" />
          Start here: Fix this critical issue
        </CardTitle>
        <CardDescription>
          This is the most important security issue to address
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-lg mb-1">
              {criticalFinding.enhancements?.plainEnglish?.problem ||
               criticalFinding.title}
            </h3>
            <p className="text-sm text-muted-foreground">
              {criticalFinding.enhancements?.plainEnglish?.impact ||
               criticalFinding.description}
            </p>
          </div>

          <div className="flex gap-2">
            <Button asChild>
              <Link to={`/findings/${criticalFinding.id}`}>
                Fix this now <ArrowRightIcon />
              </Link>
            </Button>
            <Button variant="outline" onClick={() => showAIHelp(criticalFinding)}>
              <SparklesIcon /> Ask AI for help
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )}

  {/* Stats Overview */}
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    <StatCard
      icon={<ShieldCheckIcon />}
      label="Protected endpoints"
      value={stats.protectedRoutes}
      total={stats.totalRoutes}
      positive
    />
    <StatCard
      icon={<AlertTriangleIcon />}
      label="Issues found"
      value={stats.totalFindings}
      severity="medium"
    />
    <StatCard
      icon={<ClockIcon />}
      label="Est. fix time"
      value={`${stats.estimatedFixTime}h`}
      info="Based on similar projects"
    />
    <StatCard
      icon={<TrendingUpIcon />}
      label="Score change"
      value={`${stats.scoreChange > 0 ? '+' : ''}${stats.scoreChange}`}
      positive={stats.scoreChange > 0}
    />
  </div>
</div>
```

---

## Implementation Timeline

### Sprint 1 (Week 1-2): Foundation
- **Phase 1**: Schema extensions
- **Phase 2**: CLI enhancement functions
- **Testing**: Ensure backward compatibility

### Sprint 2 (Week 3-4): Basic UI
- **Phase 3**: Plain English, severity context, "Why This Matters"
- **Phase 5**: Progressive disclosure
- **Testing**: User testing with non-technical developers

### Sprint 3 (Week 5-6): Code Assistance
- **Phase 4**: Code comparison, Copy to AI, Fix wizard
- **Testing**: Validate AI prompts work well

### Sprint 4 (Week 7-8): Advanced Features
- **Phase 6**: AI assistant dialog, smart waivers
- **Phase 7**: Related findings, batch operations
- **Phase 8**: Dashboard redesign
- **Testing**: End-to-end user flows

### Sprint 5 (Week 9-10): Polish & Launch
- Documentation
- Video tutorials
- Beta testing
- Launch

---

## Success Metrics

### Quantitative
- [ ] 80%+ of findings have enhanced fields populated
- [ ] Average time to understand a finding < 2 minutes
- [ ] 60%+ of users use "Copy to AI" feature
- [ ] 50%+ reduction in "I don't understand" support tickets

### Qualitative
- [ ] Non-security developers can explain findings in their own words
- [ ] Users feel confident applying fixes without security expertise
- [ ] AI-generated fixes are correct 90%+ of the time
- [ ] Users prefer VibeCheck over other security tools for clarity

---

## Technical Considerations

### Performance
- Enhanced content adds ~2-5KB per finding
- Consider lazy loading enhancement content
- Cache AI prompt templates
- Debounce copy-to-clipboard operations

### Accessibility
- Ensure all interactive elements are keyboard accessible
- Provide alt text for icons and badges
- Support screen readers for code comparisons
- High contrast mode for severity badges

### Browser Support
- Target modern browsers (Chrome, Firefox, Safari, Edge)
- Fallback for clipboard API
- LocalStorage for waiver tracking
- Service worker for offline support

### Data Privacy
- All processing happens locally
- No external API calls for enhancements
- User waivers stored in IndexedDB only
- Export waiver history as JSON

---

## Future Enhancements (Post-Launch)

1. **Video Tutorials**: Embedded video explanations for complex findings
2. **Interactive Playgrounds**: Try exploits in safe sandboxes
3. **Community Fixes**: Share and vote on fix approaches
4. **AI Integration**: Direct API integration with Claude/ChatGPT
5. **Mobile App**: View and triage findings on mobile
6. **VS Code Extension**: View findings inline in editor
7. **Gamification**: Points and badges for fixing issues
8. **Team Features**: Assign findings, track progress

---

## Questions for Discussion

1. Should we generate enhancements at scan time or dynamically in the viewer?
   - **Recommendation**: Scan time - ensures offline viewing works

2. How detailed should code comparisons be?
   - **Recommendation**: Show full function context, not just changed lines

3. Should AI prompts open in new tab or copy to clipboard?
   - **Recommendation**: Dropdown with both options

4. How to handle findings without enhancement data?
   - **Recommendation**: Graceful fallback to original content

5. Should batch fixes apply immediately or require review?
   - **Recommendation**: Generate patches, require review before applying
