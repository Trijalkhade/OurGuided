import React from 'react';
import privacyHtml from './privacy.html?raw';

const PrivacyPolicy = () => {
    return (
        <div 
            className="privacy-policy-container" 
            style={{ 
                padding: '2rem', 
                maxWidth: '1000px', 
                margin: '0 auto', 
                backgroundColor: 'white', 
                color: 'black',
                lineHeight: '1.6',
                fontFamily: 'Arial, sans-serif'
            }}
        >
            <div dangerouslySetInnerHTML={{ __html: privacyHtml }} />
        </div>
    );
};

export default PrivacyPolicy;
