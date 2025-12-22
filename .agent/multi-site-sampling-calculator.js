// ============================================
// MULTI-SITE SAMPLING CALCULATOR (IAF MD 1)
// ============================================

function calculateSiteSampling(totalSites, riskLevel, maturityLevel, mandatorySites = []) {
    // IAF MD 1 Formula: Sample = √n
    let baseSample = Math.sqrt(totalSites);

    // Risk adjustments
    const riskMultiplier = {
        'Low': 0.8,
        'Medium': 1.0,
        'High': 1.2
    };

    // Maturity adjustments (inverse of risk for simplicity)
    const maturityMultiplier = {
        'Low': 1.2,      // Low maturity = higher sample
        'Normal': 1.0,
        'High': 0.8      // High maturity = lower sample
    };

    let adjustedSample = baseSample * (riskMultiplier[riskLevel] || 1.0) * (maturityMultiplier[maturityLevel] || 1.0);

    // Round up
    adjustedSample = Math.ceil(adjustedSample);

    // Minimum 25% of sites
    const minimumSample = Math.ceil(totalSites * 0.25);
    adjustedSample = Math.max(adjustedSample, minimumSample);

    // Never exceed total sites
    adjustedSample = Math.min(adjustedSample, totalSites);

    // Account for mandatory sites
    const mandatoryCount = mandatorySites.length;
    const randomSitesNeeded = Math.max(0, adjustedSample - mandatoryCount);

    return {
        totalSites,
        sampleSize: adjustedSample,
        mandatorySites: mandatoryCount,
        randomSites: randomSitesNeeded,
        baseSample: Math.ceil(baseSample),
        minimumRequired: minimumSample
    };
}

function renderMultiSiteSamplingCalculator() {
    const html = `
        <div class="fade-in">
            <div class="card" style="max-width: 900px; margin: 0 auto;">
                <h2 style="margin-bottom: 1rem; color: var(--primary-color);">
                    <i class="fa-solid fa-map-marked-alt" style="margin-right: 0.5rem;"></i>
                    Multi-Site Sampling Calculator (IAF MD 1)
                </h2>
                <p style="color: var(--text-secondary); margin-bottom: 2rem;">
                    Calculate the number of sites to audit based on IAF Mandatory Document 1 requirements
                </p>

                <form id="sampling-form" style="margin-bottom: 2rem;">
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem;">
                        <!-- Total Sites -->
                        <div class="form-group">
                            <label for="total-sites">Total Number of Sites <span style="color: var(--danger-color);">*</span></label>
                            <input type="number" id="total-sites" min="1" value="10" required>
                            <small style="color: var(--text-secondary); font-size: 0.8rem;">All client locations</small>
                        </div>

                        <!-- Risk Level -->
                        <div class="form-group">
                            <label for="risk-level">Risk Level <span style="color: var(--danger-color);">*</span></label>
                            <select id="risk-level" required>
                                <option value="Low">Low (Simple operations)</option>
                                <option value="Medium" selected>Medium (Standard operations)</option>
                                <option value="High">High (Complex/hazardous)</option>
                            </select>
                        </div>

                        <!-- Maturity Level -->
                        <div class="form-group">
                            <label for="maturity-level">Management System Maturity <span style="color: var(--danger-color);">*</span></label>
                            <select id="maturity-level" required>
                                <option value="Low">Low (First certification)</option>
                                <option value="Normal" selected>Normal (Established)</option>
                                <option value="High">High (Mature, proven)</option>
                            </select>
                        </div>

                        <!-- Mandatory Sites -->
                        <div class="form-group">
                            <label for="mandatory-sites">Mandatory Sites Count</label>
                            <input type="number" id="mandatory-sites" min="0" value="1">
                            <small style="color: var(--text-secondary); font-size: 0.8rem;">HQ, special processes, NCR sites</small>
                        </div>
                    </div>

                    <button type="submit" class="btn btn-primary" style="margin-top: 1.5rem; width: 100%;">
                        <i class="fa-solid fa-calculator" style="margin-right: 0.5rem;"></i>
                        Calculate Sample Size
                    </button>
                </form>

                <!-- Results Section -->
                <div id="sampling-results" style="display: none;">
                    <hr style="border: none; border-top: 2px solid var(--border-color); margin: 2rem 0;">
                    
                    <h3 style="margin-bottom: 1.5rem; color: var(--primary-color);">
                        <i class="fa-solid fa-chart-pie" style="margin-right: 0.5rem;"></i>
                        Sampling Results
                    </h3>

                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem;">
                        <div class="card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center; padding: 1.5rem;">
                            <p style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.5rem;">Total Sample Size</p>
                            <p style="font-size: 2.5rem; font-weight: 700; margin: 0;" id="result-sample-size">--</p>
                            <p style="font-size: 0.875rem; opacity: 0.9; margin-top: 0.5rem;">sites to audit</p>
                        </div>

                        <div class="card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; text-align: center; padding: 1.5rem;">
                            <p style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.5rem;">Mandatory Sites</p>
                            <p style="font-size: 2.5rem; font-weight: 700; margin: 0;" id="result-mandatory">--</p>
                            <p style="font-size: 0.875rem; opacity: 0.9; margin-top: 0.5rem;">must audit</p>
                        </div>

                        <div class="card" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; text-align: center; padding: 1.5rem;">
                            <p style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.5rem;">Random Selection</p>
                            <p style="font-size: 2.5rem; font-weight: 700; margin: 0;" id="result-random">--</p>
                            <p style="font-size: 0.875rem; opacity: 0.9; margin-top: 0.5rem;">sites</p>
                        </div>
                    </div>

                    <!-- Calculation Details -->
                    <div class="card" style="background: #f8fafc; padding: 1.5rem;">
                        <h4 style="margin: 0 0 1rem 0; font-size: 1rem;">Calculation Breakdown</h4>
                        <div id="sampling-details" style="font-size: 0.9rem; color: var(--text-secondary);"></div>
                    </div>

                    <!-- IAF MD 1 Reference -->
                    <div style="margin-top: 1.5rem; padding: 1rem; background: #eff6ff; border-left: 4px solid #0284c7; border-radius: 4px;">
                        <p style="margin: 0; font-size: 0.85rem; color: #0369a1;">
                            <i class="fa-solid fa-info-circle" style="margin-right: 0.5rem;"></i>
                            <strong>IAF MD 1 Formula:</strong> Sample = √n (square root of total sites), adjusted for risk and maturity. Minimum 25% of sites must be audited.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    `;

    window.contentArea.innerHTML = html;

    // Form submission handler
    document.getElementById('sampling-form').addEventListener('submit', (e) => {
        e.preventDefault();

        const totalSites = parseInt(document.getElementById('total-sites').value);
        const riskLevel = document.getElementById('risk-level').value;
        const maturityLevel = document.getElementById('maturity-level').value;
        const mandatoryCount = parseInt(document.getElementById('mandatory-sites').value) || 0;

        // Create array of mandatory sites (just count for now)
        const mandatorySites = Array(mandatoryCount).fill('Mandatory');

        // Calculate
        const results = calculateSiteSampling(totalSites, riskLevel, maturityLevel, mandatorySites);

        // Display results
        document.getElementById('result-sample-size').textContent = results.sampleSize;
        document.getElementById('result-mandatory').textContent = results.mandatorySites;
        document.getElementById('result-random').textContent = results.randomSites;

        // Show breakdown
        const details = `
            <div style="display: grid; gap: 0.5rem;">
                <div><strong>Formula Application:</strong></div>
                <div>• Base Sample (√${totalSites}): ${results.baseSample} sites</div>
                <div>• Risk Adjustment (${riskLevel}): ${riskLevel === 'Low' ? '×0.8' : riskLevel === 'High' ? '×1.2' : '×1.0'}</div>
                <div>• Maturity Adjustment (${maturityLevel}): ${maturityLevel === 'Low' ? '×1.2' : maturityLevel === 'High' ? '×0.8' : '×1.0'}</div>
                <div>• Minimum Required (25% of ${totalSites}): ${results.minimumRequired} sites</div>
                <div style="margin-top: 0.5rem;"><strong>Final Sample:</strong></div>
                <div>• ${results.mandatorySites} mandatory sites (HQ, special processes, NCR sites)</div>
                <div>• ${results.randomSites} sites selected randomly from remaining ${totalSites - results.mandatorySites} sites</div>
                <div>• <strong>Total: ${results.sampleSize} sites to audit</strong></div>
            </div>
        `;
        document.getElementById('sampling-details').innerHTML = details;

        // Show results section
        document.getElementById('sampling-results').style.display = 'block';

        // Scroll to results
        document.getElementById('sampling-results').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
}
