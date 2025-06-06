import { useEffect } from "react";

const SEOHead = ({
  title,
  description,
  image,
  url,
  type = "article",
  publishedTime,
  author = "XKMato",
}) => {
  useEffect(() => {
    // Update document title
    document.title = title
      ? `${title} | XKMato`
      : "XKMato - Thinking Out Loud About Reality, Knowledge & Creativity";

    // Update meta tags
    const updateMetaTag = (property, content) => {
      let element =
        document.querySelector(`meta[property="${property}"]`) ||
        document.querySelector(`meta[name="${property}"]`);

      if (!element) {
        element = document.createElement("meta");
        if (property.startsWith("og:") || property.startsWith("twitter:")) {
          element.setAttribute("property", property);
        } else {
          element.setAttribute("name", property);
        }
        document.head.appendChild(element);
      }

      element.setAttribute("content", content);
    };

    // Basic meta tags
    if (description) {
      updateMetaTag("description", description);
    }

    if (url) {
      updateMetaTag("canonical", url);
      // Update canonical link
      let canonical = document.querySelector('link[rel="canonical"]');
      if (!canonical) {
        canonical = document.createElement("link");
        canonical.setAttribute("rel", "canonical");
        document.head.appendChild(canonical);
      }
      canonical.setAttribute("href", url);
    }

    // Open Graph tags
    updateMetaTag(
      "og:title",
      title ||
        "XKMato - Thinking Out Loud About Reality, Knowledge & Creativity"
    );
    updateMetaTag(
      "og:description",
      description ||
        "Welcome to xkmato — a space where I think out loud, explore the nature of our reality, share hard-earned knowledge, and take creative swings within my reach."
    );
    updateMetaTag("og:type", type);
    updateMetaTag("og:url", url || "https://xkmato.com");

    if (image) {
      updateMetaTag("og:image", image);
    }

    if (publishedTime) {
      updateMetaTag("article:published_time", publishedTime);
      updateMetaTag("article:author", author);
    }

    // Twitter tags
    updateMetaTag(
      "twitter:title",
      title ||
        "XKMato - Thinking Out Loud About Reality, Knowledge & Creativity"
    );
    updateMetaTag(
      "twitter:description",
      description ||
        "Welcome to xkmato — a space where I think out loud, explore the nature of our reality, share hard-earned knowledge, and take creative swings within my reach."
    );

    if (image) {
      updateMetaTag("twitter:image", image);
    }

    // Structured data for articles
    if (type === "article" && title && description) {
      const structuredData = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: title,
        description: description,
        author: {
          "@type": "Person",
          name: author,
        },
        publisher: {
          "@type": "Person",
          name: "XKMato",
        },
        datePublished: publishedTime,
        url: url,
        image: image,
      };

      let scriptTag = document.querySelector(
        'script[data-type="structured-data"]'
      );
      if (!scriptTag) {
        scriptTag = document.createElement("script");
        scriptTag.setAttribute("type", "application/ld+json");
        scriptTag.setAttribute("data-type", "structured-data");
        document.head.appendChild(scriptTag);
      }
      scriptTag.textContent = JSON.stringify(structuredData);
    }
  }, [title, description, image, url, type, publishedTime, author]);

  return null;
};

export default SEOHead;
