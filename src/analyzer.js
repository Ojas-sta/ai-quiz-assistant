class AnalyzerLayer {
    constructor() {
        this.stats = {
            totalAttempts: 0,
            domSuccesses: 0,
            ocrAttempts: 0,
            ocrSuccesses: 0,
            aiResponses: 0
        };
        this.vulnerabilities = [];
    }

    evaluate(extractedData, extractionMethod, aiOutput, stressMode) {
        this.stats.totalAttempts++;
        
        let report = {
            scrapableViaDOM: false,
            ocrSucceeded: false,
            aiSuccessfullyAnswered: false,
            vulnerabilities: [],
            defenses: []
        };

        if (extractionMethod === 'DOM' && extractedData) {
            this.stats.domSuccesses++;
            report.scrapableViaDOM = true;
            report.vulnerabilities.push("Easily Scrapable via DOM: The question and options are presented in semantic HTML that bots can easily parse.");
            report.defenses.push("DOM Obfuscation: Randomize class names, insert invisible decoy text, or split characters into separate span tags to confuse naive scrapers.");
        }

        if (extractionMethod === 'OCR') {
            this.stats.ocrAttempts++;
            if (extractedData && extractedData.question && extractedData.question.length > 5) {
                this.stats.ocrSuccesses++;
                report.ocrSucceeded = true;
                report.vulnerabilities.push("OCR Susceptible: Text is rendered clearly with high contrast, allowing fallback OCR tools to easily extract the quiz contents.");
                report.defenses.push("Canvas Rendering / Distortion: Render text to a canvas element with subtle background noise or distortions that are readable by humans but trip up OCR engines like Tesseract.");
            } else {
                report.vulnerabilities.push("Partial OCR defense detected (or OCR failed). Text was not easily readable.");
            }
        }

        if (aiOutput && aiOutput.selectedOption) {
            this.stats.aiResponses++;
            report.aiSuccessfullyAnswered = true;
            if (aiOutput.confidenceScore > 80) {
                report.vulnerabilities.push("Easily Queryable: The question format is standard and can be directly piped into an LLM for an accurate answer.");
                report.defenses.push("Contextual/Visual Questions: Use questions that require interpreting a complex image or diagram, making it harder for text-only LLMs to solve without multi-modal processing.");
            }
        }

        // Timing patterns (simulated)
        report.vulnerabilities.push("Predictable Timing: The bot completed extraction and AI reasoning in a very short, non-human timeframe.");
        report.defenses.push("Behavioral Monitoring & Timing Checks: Monitor the time between page load and 'answer selection'. Bots often interact too quickly or with mathematically perfect intervals. Implement 'honeypot' delays.");

        // If stress mode is active but the bot still succeeded, highlight that DOM randomization isn't enough
        if (stressMode && report.ocrSucceeded) {
             report.vulnerabilities.push("Weak Obfuscation: While the DOM was obfuscated (stress mode), the visual rendering was unaffected, allowing OCR to bypass the DOM defenses.");
        }

        this.vulnerabilities.push(report);
        return report;
    }

    printSummary() {
        console.log("\n=================================================");
        console.log("   VULNERABILITY & DEFENSE RECOMMENDATION REPORT  ");
        console.log("=================================================");
        console.log(`Total Quiz Attempts: ${this.stats.totalAttempts}`);
        console.log(`Successful DOM Scrapes: ${this.stats.domSuccesses}`);
        console.log(`OCR Fallback Attempts: ${this.stats.ocrAttempts}`);
        console.log(`Successful OCR Extracts: ${this.stats.ocrSuccesses}`);
        console.log(`Valid AI Responses: ${this.stats.aiResponses}`);
        
        console.log("\n--- Common Vulnerabilities Detected ---");
        const allVulns = new Set();
        const allDefs = new Set();
        
        this.vulnerabilities.forEach(v => {
            v.vulnerabilities.forEach(vuln => allVulns.add(vuln));
            v.defenses.forEach(def => allDefs.add(def));
        });

        allVulns.forEach(v => console.log(`[!] ${v}`));
        
        console.log("\n--- Recommended Defenses ---");
        allDefs.forEach(d => console.log(`[+] ${d}`));
        
        console.log("=================================================\n");
    }
}

module.exports = AnalyzerLayer;
