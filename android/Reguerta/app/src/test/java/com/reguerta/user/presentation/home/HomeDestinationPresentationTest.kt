package com.reguerta.user.presentation.home

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class HomeDestinationPresentationTest {
    @Test
    fun `news and community place title below navigation`() {
        assertTrue(HomeDestination.NEWS.placesTitleBelowNavigation())
        assertTrue(HomeDestination.PROFILE.placesTitleBelowNavigation())
    }

    @Test
    fun `unrelated destinations retain inline title placement`() {
        HomeDestination.entries
            .filterNot { it == HomeDestination.NEWS || it == HomeDestination.PROFILE }
            .forEach { destination ->
                assertFalse(destination.placesTitleBelowNavigation())
            }
    }
}
