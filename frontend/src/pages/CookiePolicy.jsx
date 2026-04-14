import React from 'react';
import cookiesHtml from './cookies.html?raw';

const CookiePolicy = () => {
    return (
        <div 
            className="cookie-policy-container" 
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
            <div dangerouslySetInnerHTML={{ __html: cookiesHtml }} />
        </div>
    );
};

export default CookiePolicy;
