
// Default Checklist Templates for Reference
function getTemplateItems(standard) {
    const commonClauses = [
        { clause: '4.1', req: 'Has the organization determined external and internal issues relevant to its purpose?' },
        { clause: '4.2', req: 'Have the needs and expectations of interested parties been determined?' },
        { clause: '4.3', req: 'Is the scope of the management system determined and documented?' },
        { clause: '5.1', req: 'Does top management demonstrate leadership and commitment?' },
        { clause: '5.2', req: 'Is the policy established, communicated, and understood?' },
        { clause: '5.3', req: 'Are organizational roles, responsibilities, and authorities assigned?' },
        { clause: '6.1', req: 'Have risks and opportunities been addressed?' },
        { clause: '6.2', req: 'Are objectives established at relevant functions and levels?' },
        { clause: '7.1', req: 'Are resources determined and provided?' },
        { clause: '7.2', req: 'Are persons competent based on education, training, or experience?' },
        { clause: '7.3', req: 'Are persons aware of the policy and their contribution to effectiveness?' },
        { clause: '7.4', req: 'Is communication (internal/external) determined?' },
        { clause: '7.5', req: 'Is documented information controlled and maintained?' },
        { clause: '8.1', req: 'Are operational processes planned and controlled?' },
        { clause: '9.1', req: 'Is performance monitored, measured, analyzed, and evaluated?' },
        { clause: '9.2', req: 'Are internal audits conducted at planned intervals?' },
        { clause: '9.3', req: 'Is management review conducted?' },
        { clause: '10.1', req: 'Are opportunities for improvement identified?' },
        { clause: '10.2', req: 'Are nonconformities and corrective actions managed?' }
    ];

    if (standard.includes('9001')) {
        return [
            ...commonClauses,
            { clause: '4.4', req: 'Are processes needed for the QMS and their interactions determined?' },
            { clause: '8.2', req: 'Are requirements for products and services determined?' },
            { clause: '8.3', req: 'Is design and development of products and services controlled?' },
            { clause: '8.4', req: 'Are externally provided processes, products, and services controlled?' },
            { clause: '8.5', req: 'Is production and service provision controlled?' },
            { clause: '8.6', req: 'Is release of products and services verified?' },
            { clause: '8.7', req: 'Is control of nonconforming outputs ensured?' }
        ];
    } else if (standard.includes('14001')) {
        return [
            ...commonClauses,
            { clause: '6.1.2', req: 'Have environmental aspects and impacts been determined?' },
            { clause: '6.1.3', req: 'Have compliance obligations been determined?' },
            { clause: '8.1', req: 'Is operational planning and control established for environmental aspects?' },
            { clause: '8.2', req: 'Is emergency preparedness and response established?' }
        ];
    } else if (standard.includes('45001')) {
        return [
            ...commonClauses,
            { clause: '5.4', req: 'Is consultation and participation of workers ensured?' },
            { clause: '6.1.2', req: 'Have hazard identification and assessment of risks been conducted?' },
            { clause: '6.1.3', req: 'Have legal and other requirements been determined?' },
            { clause: '8.1.3', req: 'Is management of change established?' },
            { clause: '8.1.4', req: 'Is procurement (including contractors and outsourcing) controlled?' },
            { clause: '8.2', req: 'Is emergency preparedness and response established?' }
        ];
    } else if (standard.includes('27001')) {
        return [
            ...commonClauses,
            { clause: '6.1.2', req: 'Has an information security risk assessment been performed?' },
            { clause: '6.1.3', req: 'Has an information security risk treatment plan been formulated?' },
            { clause: '8.2', req: 'Has an information security risk assessment been performed at planned intervals?' },
            { clause: '8.3', req: 'Has the information security risk treatment plan been implemented?' },
            { clause: 'A.5', req: 'Are information security policies written and approved?' },
            { clause: 'A.6', req: 'Is organization of information security established?' },
            { clause: 'A.7', req: 'Is human resource security ensured (prior to, during, and after employment)?' },
            { clause: 'A.8', req: 'Is asset management established?' },
            { clause: 'A.9', req: 'Is access control policy established and enforced?' },
            { clause: 'A.10', req: 'Is cryptography used effectively?' },
            { clause: 'A.11', req: 'Is physical and environmental security ensured?' },
            { clause: 'A.12', req: 'Is operations security ensured?' },
            { clause: 'A.13', req: 'Is communications security ensured?' },
            { clause: 'A.14', req: 'Is system acquisition, development and maintenance controlled?' },
            { clause: 'A.15', req: 'Are supplier relationships controlled?' },
            { clause: 'A.16', req: 'Is information security incident management established?' },
            { clause: 'A.17', req: 'Is information security aspects of business continuity management established?' },
            { clause: 'A.18', req: 'Is compliance with legal and contractual requirements ensured?' }
        ];
    }

    return commonClauses;
}

window.loadChecklistTemplate = function (standard) {
    if (!standard) return;

    if (confirm('This will replace any existing items in the editor. Continue?')) {
        const items = getTemplateItems(standard);
        const tbody = document.getElementById('checklist-items-body');

        // Clear existing
        tbody.innerHTML = '';

        items.forEach(item => {
            const newRow = document.createElement('tr');
            newRow.className = 'checklist-item-row';
            newRow.innerHTML = `
                <td style="padding: 0.5rem;"><input type="text" class="form-control item-clause" value="${window.UTILS.escapeHtml(item.clause)}" style="margin: 0;"></td>
                <td style="padding: 0.5rem;"><input type="text" class="form-control item-requirement" value="${window.UTILS.escapeHtml(item.req)}" style="margin: 0;"></td>
                <td style="padding: 0.5rem;"><button type="button" class="btn btn-sm btn-danger remove-item-row"><i class="fa-solid fa-times"></i></button></td>
            `;
            tbody.appendChild(newRow);
        });

        attachRemoveRowListeners();

        // Also update standard selection
        const stdSelect = document.getElementById('checklist-standard');
        if (stdSelect) stdSelect.value = standard;

        window.showNotification(`Loaded ${items.length} clauses for ${standard}`, 'success');
    } else {
        // Reset dropdown if cancelled
        document.getElementById('checklist-template-select').value = '';
    }
};
